import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import type { IsoDate } from "@/lib/dates/working-days";
import { query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import { type ExternalFirstResult, externalFirst } from "@/lib/external-first";
import {
	getLaptopHaloClient,
	type HaloStockDevice,
} from "@/services/replacements/laptops/lib/halo";

/**
 * Replacement devices (spec, "Stock"): the latest Halo stock list, kept in
 * lr.halo_stock, with each box's allocation to a case from the portal.
 * Halo isn't changed until a replacement is completed.
 */

const LONDON = "'Europe/London'";

export type StockSnapshot = { fetchedAt: Date; devices: HaloStockDevice[] };

export async function getStockSnapshot(): Promise<StockSnapshot | null> {
	const row = await queryOne<{ fetched_at: Date; devices: HaloStockDevice[] }>(
		"SELECT fetched_at, devices FROM lr.halo_stock WHERE id = 1",
	);
	return row ? { fetchedAt: row.fetched_at, devices: row.devices } : null;
}

/** "Refresh from Halo": replaces the stock list and notes boxes seen for the first time. */
export async function refreshStock(
	actorId: string,
	label = "Refresh stock from Halo",
): Promise<ExternalFirstResult<number>> {
	return externalFirst({
		call: () =>
			getLaptopHaloClient().listStock({
				trigger: { kind: "user", label, actorUserId: actorId },
			}),
		save: async (tx, { value: devices }) => {
			await query(
				`INSERT INTO lr.halo_stock (id, fetched_at, fetched_by, devices)
				 VALUES (1, now(), $1, $2::jsonb)
				 ON CONFLICT (id) DO UPDATE SET fetched_at = now(), fetched_by = $1, devices = $2::jsonb`,
				[actorId, JSON.stringify(devices)],
				tx,
			);
			await query(
				`INSERT INTO lr.device_journal (box_number, actor_system, kind, body)
				 SELECT box, 'Refresh stock from Halo', 'stock', 'First seen in Halo stock'
				 FROM unnest($1::text[]) AS box
				 WHERE NOT EXISTS (SELECT 1 FROM lr.device_journal j WHERE j.box_number = box)
				   AND NOT EXISTS (SELECT 1 FROM lr.device_allocations a WHERE a.box_number = box)`,
				[devices.map((device) => device.assetId)],
				tx,
			);
			return devices.length;
		},
		actingUserId: actorId,
	});
}

/** The stock list, read from Halo first if there isn't one yet. */
export async function loadStock(
	actorId: string,
): Promise<{ snapshot: StockSnapshot | null; failed: string | null }> {
	const snapshot = await getStockSnapshot();
	if (snapshot) return { snapshot, failed: null };
	const result = await refreshStock(actorId, "Stock (first load)");
	return result.ok
		? { snapshot: await getStockSnapshot(), failed: null }
		: { snapshot: null, failed: result.failure.message };
}

export type Allocation = {
	boxNumber: string;
	caseId: string;
	reference: string;
	name: string;
	type: ReplacementType;
	session: { date: IsoDate; time: string } | null;
	allocatedAt: Date;
};

/** Boxes currently allocated to a case. */
export async function currentAllocations(): Promise<Map<string, Allocation>> {
	const rows = await query<{
		box_number: string;
		case_id: string;
		reference: string;
		name: string;
		type: ReplacementType;
		session_date: IsoDate | null;
		session_time: string | null;
		allocated_at: Date;
	}>(
		`SELECT a.box_number, c.id AS case_id, c.reference, u.display_name AS name, c.session_type AS type,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS session_date,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'HH24:MI') AS session_time,
		        a.allocated_at
		 FROM lr.device_allocations a
		 JOIN lr.cases c ON c.id = a.case_id
		 JOIN portal.users u ON u.id = c.user_id
		 LEFT JOIN lr.bookings b ON b.case_id = c.id AND b.status = 'booked'
		 LEFT JOIN lr.sessions s ON s.id = b.session_id
		 WHERE a.removed_at IS NULL`,
	);
	return new Map(
		rows.map((row) => [
			row.box_number,
			{
				boxNumber: row.box_number,
				caseId: row.case_id,
				reference: row.reference,
				name: row.name,
				type: row.type,
				session:
					row.session_date && row.session_time
						? { date: row.session_date, time: row.session_time }
						: null,
				allocatedAt: row.allocated_at,
			},
		]),
	);
}

/**
 * Boxes already issued to someone. Halo takes them out of stock, but the
 * saved stock list still has them until the next refresh.
 */
async function issuedBoxes(): Promise<Set<string>> {
	const rows = await query<{ box_number: string }>(
		"SELECT DISTINCT box_number FROM lr.device_allocations WHERE outcome = 'issued'",
	);
	return new Set(rows.map((row) => row.box_number));
}

/** Devices in stock that no case holds and that haven't been issued: the case page's dropdown. */
export async function availableDevices(actorId: string): Promise<HaloStockDevice[]> {
	const [{ snapshot }, allocations, issued] = await Promise.all([
		loadStock(actorId),
		currentAllocations(),
		issuedBoxes(),
	]);
	return (snapshot?.devices ?? [])
		.filter((device) => !allocations.has(device.assetId) && !issued.has(device.assetId))
		.sort((a, b) => a.assetId.localeCompare(b.assetId));
}

export type StockRow = HaloStockDevice & {
	status: "available" | "allocated" | "issued";
	allocation: Allocation | null;
	lastActivity: { at: Date; body: string } | null;
};

export type StockFilters = {
	search: string;
	status: "" | "available" | "allocated";
	model: string;
	location: string;
	issued: boolean;
};

/** The Stock list: Halo's stock with allocations, and optionally the devices already issued. */
export async function listStock(
	snapshot: StockSnapshot,
	filters: StockFilters,
): Promise<StockRow[]> {
	const [allocations, activity, issued] = await Promise.all([
		currentAllocations(),
		query<{ box_number: string; occurred_at: Date; body: string }>(
			`SELECT DISTINCT ON (box_number) box_number, occurred_at, body
			 FROM lr.device_journal ORDER BY box_number, occurred_at DESC, id DESC`,
		),
		query<{ box_number: string; removed_at: Date }>(
			"SELECT box_number, removed_at FROM lr.device_allocations WHERE outcome = 'issued'",
		),
	]);
	const lastActivity = new Map(
		activity.map((row) => [row.box_number, { at: row.occurred_at, body: row.body }]),
	);

	const issuedSet = new Set(issued.map((row) => row.box_number));
	const rows: StockRow[] = snapshot.devices.map((device) => ({
		...device,
		status: allocations.has(device.assetId)
			? "allocated"
			: issuedSet.has(device.assetId)
				? "issued"
				: "available",
		allocation: allocations.get(device.assetId) ?? null,
		lastActivity: lastActivity.get(device.assetId) ?? null,
	}));
	for (const row of filters.issued ? issued : []) {
		if (rows.some((device) => device.assetId === row.box_number)) continue;
		rows.push({
			assetId: row.box_number,
			serial: "",
			hostname: "",
			model: "",
			stockLocation: "",
			stockRoom: "",
			status: "issued",
			allocation: null,
			lastActivity: lastActivity.get(row.box_number) ?? null,
		});
	}

	const needle = filters.search.toLowerCase();
	return rows
		.filter(
			(row) =>
				(!needle ||
					[row.assetId, row.serial, row.hostname].some((value) =>
						value.toLowerCase().includes(needle),
					)) &&
				(filters.issued || row.status !== "issued") &&
				(!filters.status || row.status === filters.status) &&
				(!filters.model || row.model === filters.model) &&
				(!filters.location || row.stockLocation === filters.location),
		)
		.sort((a, b) => a.assetId.localeCompare(b.assetId));
}

export type DeviceDetail = {
	boxNumber: string;
	device: HaloStockDevice | null;
	status: "available" | "allocated" | "issued" | "not_in_stock";
	allocation: Allocation | null;
	history: {
		id: string;
		reference: string;
		name: string;
		allocatedAt: Date;
		allocatedBy: string | null;
		removedAt: Date | null;
		removedBy: string | null;
		outcome: "issued" | "unallocated" | "case_withdrawn" | null;
		reason: string | null;
	}[];
	journal: { id: string; at: Date; body: string; who: string }[];
};

export async function getDevice(
	boxNumber: string,
	snapshot: StockSnapshot | null,
): Promise<DeviceDetail | null> {
	const [allocations, history, journal] = await Promise.all([
		currentAllocations(),
		query<{
			id: string;
			reference: string;
			name: string;
			allocated_at: Date;
			allocated_by: string | null;
			removed_at: Date | null;
			removed_by: string | null;
			outcome: DeviceDetail["history"][number]["outcome"];
			reason: string | null;
		}>(
			`SELECT a.id, c.reference, u.display_name AS name, a.allocated_at, ab.display_name AS allocated_by,
			        a.removed_at, rb.display_name AS removed_by, a.outcome, a.removed_reason AS reason
			 FROM lr.device_allocations a
			 JOIN lr.cases c ON c.id = a.case_id
			 JOIN portal.users u ON u.id = c.user_id
			 LEFT JOIN portal.users ab ON ab.id = a.allocated_by
			 LEFT JOIN portal.users rb ON rb.id = a.removed_by
			 WHERE a.box_number = $1
			 ORDER BY a.allocated_at DESC, a.id DESC`,
			[boxNumber],
		),
		query<{
			id: string;
			occurred_at: Date;
			body: string;
			actor: string | null;
			actor_system: string | null;
		}>(
			`SELECT j.id, j.occurred_at, j.body, u.display_name AS actor, j.actor_system
			 FROM lr.device_journal j LEFT JOIN portal.users u ON u.id = j.actor_user_id
			 WHERE j.box_number = $1
			 ORDER BY j.occurred_at DESC, j.id DESC`,
			[boxNumber],
		),
	]);
	const device = snapshot?.devices.find((d) => d.assetId === boxNumber) ?? null;
	if (!device && history.length === 0 && journal.length === 0) return null;
	const allocation = allocations.get(boxNumber) ?? null;
	const issued = history.some((row) => row.outcome === "issued");

	return {
		boxNumber,
		device,
		status: allocation
			? "allocated"
			: issued
				? "issued"
				: device
					? "available"
					: "not_in_stock",
		allocation,
		history: history.map((row) => ({
			id: row.id,
			reference: row.reference,
			name: row.name,
			allocatedAt: row.allocated_at,
			allocatedBy: row.allocated_by,
			removedAt: row.removed_at,
			removedBy: row.removed_by,
			outcome: row.outcome,
			reason: row.reason,
		})),
		journal: journal.map((row) => ({
			id: row.id,
			at: row.occurred_at,
			body: row.body,
			who: row.actor ?? (row.actor_system ? `System · ${row.actor_system}` : "System"),
		})),
	};
}

export async function addDeviceNote(boxNumber: string, text: string, actorId: string) {
	await withTransaction(
		(tx) =>
			query(
				"INSERT INTO lr.device_journal (box_number, actor_user_id, kind, body) VALUES ($1, $2, 'note', $3)",
				[boxNumber, actorId, `Note: ${text}`],
				tx,
			),
		{ actingUserId: actorId },
	);
}
