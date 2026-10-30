import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { upsertUserFromHalo } from "@/lib/auth/sign-in";
import { getHaloUsersClient, type HaloUser } from "@/lib/clients/halo/users";
import { queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import {
	CASE_STATUS_LABELS,
	type CaseStatus,
} from "@/services/replacements/laptops/lib/case-status";
import {
	getLaptopHaloClient,
	type HaloEndOfLifeDevice,
} from "@/services/replacements/laptops/lib/halo";
import { addJournalEntry } from "@/services/replacements/laptops/lib/journal";

/**
 * Add a case by hand (spec, "Add a case"): look the old laptop up in Halo
 * by serial, check it can be added, and put the case in the name of the
 * person receiving the new laptop, keeping the Halo assigned user for
 * reference.
 */

export type DeviceLookup =
	| { found: false; message: string }
	| {
			found: true;
			device: HaloEndOfLifeDevice;
			assignedUser: HaloUser | null;
			/** Why the laptop can't be added, or null if it can. */
			problem: string | null;
	  };

export async function lookUpDevice(serial: string, actorId: string): Promise<DeviceLookup> {
	const trigger = { kind: "user" as const, label: "Add a case", actorUserId: actorId };
	const { value: device } = await getLaptopHaloClient().findDeviceBySerial(serial, { trigger });
	if (!device)
		return { found: false, message: "No laptop with this serial number was found in Halo" };

	const assignedUser = device.assignedUser
		? (await getHaloUsersClient().findByEmail(device.assignedUser.email, { trigger })).value
		: null;
	return { found: true, device, assignedUser, problem: await canAdd(device) };
}

async function canAdd(device: HaloEndOfLifeDevice): Promise<string | null> {
	const open = await queryOne<{ reference: string; status: CaseStatus }>(
		`SELECT reference, status FROM lr.cases
		 WHERE old_asset_id = $1 AND status NOT IN ('completed', 'withdrawn')`,
		[device.assetId],
	);
	if (open) {
		return `This laptop already has an open case (${open.reference}, ${CASE_STATUS_LABELS[open.status].toLowerCase()}).`;
	}
	const done = await queryOne<{ reference: string | null }>(
		`SELECT reference FROM lr.cases WHERE old_asset_id = $1 AND status = 'completed'
		 UNION ALL
		 SELECT NULL FROM lr.previous_replacements WHERE old_asset_id = $1 OR old_serial = $2
		 LIMIT 1`,
		[device.assetId, device.serial],
	);
	if (done) {
		return done.reference
			? `This laptop has already been replaced (${done.reference}).`
			: "This laptop has already been replaced, recorded in the old workbook.";
	}
	if (!device.assignedUser)
		return "No user is assigned to this laptop in Halo. Fix it in Halo first.";
	return null;
}

export async function lookUpPerson(email: string, actorId: string): Promise<HaloUser | null> {
	const { value } = await getHaloUsersClient().findByEmail(email, {
		trigger: { kind: "user", label: "Add a case", actorUserId: actorId },
	});
	return value;
}

export type CreateCaseResult =
	| { ok: true; id: string; reference: string }
	| { ok: false; error: string };

/**
 * Creates a Queued case. Checks again that the laptop can be added, as
 * someone may have added it since the lookup.
 */
export async function createCase(
	{
		device,
		assignedUser,
		receiver,
		type,
	}: {
		device: HaloEndOfLifeDevice;
		assignedUser: HaloUser;
		/** The person receiving the laptop, when not the assigned user. */
		receiver: HaloUser | null;
		type: ReplacementType;
	},
	actorId: string,
): Promise<CreateCaseResult> {
	const problem = await canAdd(device);
	if (problem) return { ok: false, error: problem };

	const created = await withTransaction(
		async (tx) => {
			const assignedId = await upsertUserFromHalo(tx, assignedUser, {
				createdVia: "case",
				createdBy: actorId,
			});
			const personId = receiver
				? await upsertUserFromHalo(tx, receiver, { createdVia: "case", createdBy: actorId })
				: assignedId;
			const row = await queryOne<{ id: string; reference: string }>(
				`INSERT INTO lr.cases
				   (user_id, halo_assigned_user_id, session_type, status, old_asset_id, old_serial,
				    old_hostname, old_make, old_model, created_by)
				 VALUES ($1, $2, $3, 'queued', $4, $5, $6, $7, $8, $9)
				 RETURNING id, reference`,
				[
					personId,
					assignedId,
					type,
					device.assetId,
					device.serial,
					device.hostname,
					device.make ?? null,
					device.model,
					actorId,
				],
				tx,
			);
			if (!row) throw new Error("Could not create the case");
			await addJournalEntry(tx, {
				caseId: row.id,
				actor: { userId: actorId },
				kind: "import",
				body: receiver
					? `Added by hand to the invitation queue as a ${type}, for ${receiver.displayName} (assigned in Halo to ${assignedUser.displayName})`
					: `Added by hand to the invitation queue as a ${type}`,
				data: { asset_id: device.assetId },
			});
			return row;
		},
		{ actingUserId: actorId },
	);
	return { ok: true, id: created.id, reference: created.reference };
}
