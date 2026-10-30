import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { upsertUserFromHalo } from "@/lib/auth/sign-in";
import type { CallContext } from "@/lib/clients/connection-log";
import { getHaloUsersClient, type HaloUser } from "@/lib/clients/halo/users";
import { query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import { type ExternalFirstResult, externalFirst } from "@/lib/external-first";
import type { CaseStatus } from "@/services/replacements/laptops/lib/case-status";
import {
	getLaptopHaloClient,
	type HaloAssignedDevice,
	type HaloEndOfLifeDevice,
} from "@/services/replacements/laptops/lib/halo";
import { addJournalEntry } from "@/services/replacements/laptops/lib/journal";

/**
 * The Import page (spec, "Import"): the latest Halo end-of-life report,
 * sorted into laptops that are eligible to queue, ones that need attention
 * first, and ones hidden because they are already in the workflow or were
 * replaced before.
 */

/** What Halo's staff directory said about the laptop's assigned user. */
export type UserCheck = "ok" | "no_user" | "not_found" | "disabled";

export type ReportDevice = HaloEndOfLifeDevice & { user: HaloUser | null; userCheck: UserCheck };

export type HaloReport = { fetchedAt: Date; devices: ReportDevice[] };

export type HiddenDevice = ReportDevice & {
	reason:
		| { kind: "open_case"; reference: string; status: CaseStatus }
		| { kind: "completed_case"; reference: string; closedAt: Date }
		| { kind: "previous"; completedOn: string | null };
};

export type ImportView = {
	report: HaloReport;
	eligible: ReportDevice[];
	attention: ReportDevice[];
	hidden: HiddenDevice[];
};

export async function getReport(): Promise<HaloReport | null> {
	const row = await queryOne<{ fetched_at: Date; devices: ReportDevice[] }>(
		"SELECT fetched_at, devices FROM lr.halo_report WHERE id = 1",
	);
	return row ? { fetchedAt: row.fetched_at, devices: row.devices } : null;
}

/**
 * "Refresh from Halo": reads the report, then checks every assigned user in
 * Halo's staff directory, and only then replaces the saved report. If
 * either call fails nothing changes.
 */
export async function refreshReport(
	actorId: string,
	trigger: CallContext["trigger"] = {
		kind: "user",
		label: "Refresh from Halo",
		actorUserId: actorId,
	},
): Promise<ExternalFirstResult<number>> {
	return externalFirst({
		call: async () => {
			const report = await getLaptopHaloClient().listEndOfLifeDevices({ trigger });
			const emails = [
				...new Set(
					report.value.flatMap((device) =>
						device.assignedUser ? [device.assignedUser.email.toLowerCase()] : [],
					),
				),
			];
			const users = await getHaloUsersClient().findByEmails(emails, { trigger });
			const devices: ReportDevice[] = report.value.map((device) => {
				const user = device.assignedUser
					? (users.value.get(device.assignedUser.email.toLowerCase()) ?? null)
					: null;
				const userCheck: UserCheck = !device.assignedUser
					? "no_user"
					: !user
						? "not_found"
						: user.active
							? "ok"
							: "disabled";
				return { ...device, user, userCheck };
			});
			return { value: devices, connection: users.connection, logId: users.logId };
		},
		save: async (tx, { value: devices }) => {
			await query(
				`INSERT INTO lr.halo_report (id, fetched_at, fetched_by, devices)
				 VALUES (1, now(), $1, $2::jsonb)
				 ON CONFLICT (id) DO UPDATE
				 SET fetched_at = now(), fetched_by = $1, devices = $2::jsonb`,
				[actorId, JSON.stringify(devices)],
				tx,
			);
			return devices.length;
		},
		actingUserId: actorId,
	});
}

/** Sorts the report into eligible, needs attention and hidden. */
export async function getImportView(report: HaloReport): Promise<ImportView> {
	const assetIds = report.devices.map((device) => device.assetId);
	const serials = report.devices.map((device) => device.serial);

	const [cases, previous] = await Promise.all([
		query<{
			old_asset_id: string;
			reference: string;
			status: CaseStatus;
			closed_at: Date | null;
		}>(
			`SELECT DISTINCT ON (old_asset_id) old_asset_id, reference, status, closed_at
			 FROM lr.cases
			 WHERE old_asset_id = ANY($1) AND status <> 'withdrawn'
			 ORDER BY old_asset_id, (status <> 'completed') DESC, id DESC`,
			[assetIds],
		),
		query<{ old_asset_id: string; old_serial: string | null; completed_on: string | null }>(
			`SELECT old_asset_id, old_serial, to_char(completed_on, 'YYYY-MM-DD') AS completed_on
			 FROM lr.previous_replacements
			 WHERE old_asset_id = ANY($1) OR old_serial = ANY($2)`,
			[assetIds, serials],
		),
	]);
	const caseByAsset = new Map(cases.map((row) => [row.old_asset_id, row]));

	const view: ImportView = { report, eligible: [], attention: [], hidden: [] };
	for (const device of report.devices) {
		const existing = caseByAsset.get(device.assetId);
		const earlier = previous.find(
			(row) => row.old_asset_id === device.assetId || row.old_serial === device.serial,
		);
		if (existing && existing.status !== "completed") {
			view.hidden.push({
				...device,
				reason: {
					kind: "open_case",
					reference: existing.reference,
					status: existing.status,
				},
			});
		} else if (existing?.closed_at) {
			view.hidden.push({
				...device,
				reason: {
					kind: "completed_case",
					reference: existing.reference,
					closedAt: existing.closed_at,
				},
			});
		} else if (earlier) {
			view.hidden.push({
				...device,
				reason: { kind: "previous", completedOn: earlier.completed_on },
			});
		} else if (device.userCheck !== "ok") {
			view.attention.push(device);
		} else {
			view.eligible.push(device);
		}
	}
	return view;
}

export type QueuedCase = { id: string; reference: string; name: string };

export type AddToQueueResult =
	| { ok: true; type: ReplacementType; cases: QueuedCase[] }
	| { ok: false; error: string };

/**
 * "Add to invitation queue": each selected laptop that is still eligible
 * becomes a Queued case of the chosen type, against its assigned user (whose
 * portal user is created from Halo if needed), in the order selected.
 */
export async function addToQueue(
	assetIds: readonly string[],
	type: ReplacementType,
	actorId: string,
): Promise<AddToQueueResult> {
	const report = await getReport();
	if (!report) return { ok: false, error: "Refresh from Halo before adding laptops" };
	const { eligible } = await getImportView(report);
	const chosen = assetIds
		.map((assetId) => eligible.find((device) => device.assetId === assetId))
		.filter((device): device is ReportDevice => Boolean(device?.user));
	if (chosen.length === 0) {
		return { ok: false, error: "Select at least one laptop to add to the invitation queue" };
	}

	const cases = await withTransaction(
		async (tx) => {
			const batch = await queryOne<{ id: string }>(
				`INSERT INTO lr.imports (imported_by, rows_total, rows_queued)
				 VALUES ($1, $2, $3) RETURNING id`,
				[actorId, assetIds.length, chosen.length],
				tx,
			);
			const created: QueuedCase[] = [];
			for (const [index, device] of chosen.entries()) {
				const user = device.user as HaloUser;
				const userId = await upsertUserFromHalo(tx, user, {
					createdVia: "case",
					createdBy: actorId,
				});
				const row = await queryOne<{ id: string; reference: string }>(
					`INSERT INTO lr.cases
					   (user_id, halo_assigned_user_id, session_type, status, old_asset_id, old_serial,
					    old_hostname, import_id, queued_at, created_by)
					 VALUES ($1, $1, $2, 'queued', $3, $4, $5, $6,
					         now() + make_interval(secs => $7::double precision / 1000), $8)
					 RETURNING id, reference`,
					[
						userId,
						type,
						device.assetId,
						device.serial,
						device.hostname,
						batch?.id,
						index,
						actorId,
					],
					tx,
				);
				if (!row) throw new Error("Could not create the case");
				await addJournalEntry(tx, {
					caseId: row.id,
					actor: { userId: actorId },
					kind: "import",
					body: `Added to the invitation queue as a ${type}`,
					data: { asset_id: device.assetId, import_id: Number(batch?.id) },
				});
				created.push({ id: row.id, reference: row.reference, name: user.displayName });
			}
			return created;
		},
		{ actingUserId: actorId },
	);
	return { ok: true, type, cases };
}

export type UserDetails = { user: HaloUser | null; devices: HaloAssignedDevice[] };

/** The user details dialog: the person in Halo and every device assigned to them. */
export async function getUserDetails(email: string, actorId: string): Promise<UserDetails> {
	const trigger = { kind: "user" as const, label: "Import user details", actorUserId: actorId };
	const [user, devices] = await Promise.all([
		getHaloUsersClient().findByEmail(email, { trigger }),
		getLaptopHaloClient().devicesAssignedTo(email, { trigger }),
	]);
	return { user: user.value, devices: devices.value };
}
