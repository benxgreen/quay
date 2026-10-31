import "server-only";

import { query, queryOne } from "@/lib/db/query";
import { fillVariables } from "@/lib/emails/render";
import { variableValues } from "@/services/replacements/laptops/lib/variables";

/**
 * Laptop replacements' Halo settings (Settings › Halo): which reports,
 * asset type, statuses, fields and lookup values the Halo client uses, and
 * the audit notes it writes. Every number is a Halo ID, chosen on the
 * settings pages from lists read from Halo.
 */
export type LaptopHaloSettings = {
	eligibleReportId: number;
	/** Null: list laptops at the in-stock status instead of a report. */
	stockReportId: number | null;
	/** ID and Serial Number for every laptop, used when the eligible report has no ID column. */
	idsReportId: number | null;
	laptopTypeId: number;
	statusInStock: number;
	statusInService: number;
	statusOutOfService: number;
	fieldSerial: number;
	fieldStockLocation: number;
	fieldStockRoom: number;
	fieldLastAuditDate: number;
	fieldAuditDetails: number;
	fieldLastSync: number | null;
	locationDecommissioned: number;
	roomReturned: number;
	/** With the audit variables, such as "Device collected by {full_name} - {case_reference}". */
	collectedNote: string;
	returnedNote: string;
};

const COLUMNS = {
	eligibleReportId: "eligible_report_id",
	stockReportId: "stock_report_id",
	idsReportId: "ids_report_id",
	laptopTypeId: "laptop_type_id",
	statusInStock: "status_in_stock",
	statusInService: "status_in_service",
	statusOutOfService: "status_out_of_service",
	fieldSerial: "field_serial",
	fieldStockLocation: "field_stock_location",
	fieldStockRoom: "field_stock_room",
	fieldLastAuditDate: "field_last_audit_date",
	fieldAuditDetails: "field_audit_details",
	fieldLastSync: "field_last_sync",
	locationDecommissioned: "location_decommissioned",
	roomReturned: "room_returned",
	collectedNote: "collected_note",
	returnedNote: "returned_note",
} as const satisfies Record<keyof LaptopHaloSettings, string>;

export async function getLaptopHaloSettings(): Promise<LaptopHaloSettings> {
	const row = await queryOne<LaptopHaloSettings>(
		`SELECT ${Object.entries(COLUMNS)
			.map(([key, column]) => `${column} AS "${key}"`)
			.join(", ")}
		 FROM lr.halo_settings WHERE id = 1`,
	);
	if (!row) throw new Error("Laptop replacements' Halo settings are missing");
	return row;
}

export async function saveLaptopHaloSettings(
	changes: Partial<LaptopHaloSettings>,
	actorId: string,
): Promise<void> {
	const entries = Object.entries(changes) as [keyof LaptopHaloSettings, unknown][];
	if (!entries.length) return;
	await query(
		`UPDATE lr.halo_settings
		 SET ${entries.map(([key], index) => `${COLUMNS[key]} = $${index + 2}`).join(", ")},
		     updated_by = $1, updated_at = now()
		 WHERE id = 1`,
		[actorId, ...entries.map(([, value]) => value)],
	);
}

/** An audit note with the service's audit variables filled in ({full_name}, {case_reference}…). */
export function fillNote(
	note: string,
	update: {
		personName: string;
		reference: string;
		oldSerial?: string | null;
		oldMake?: string | null;
		oldModel?: string | null;
	},
): string {
	return fillVariables(
		note,
		variableValues("audit", {
			firstName: update.personName.split(" ")[0],
			fullName: update.personName,
			caseReference: update.reference,
			oldSerial: update.oldSerial ?? null,
			oldMake: update.oldMake ?? null,
			oldModel: update.oldModel ?? null,
			type: "collection",
			booking: null,
			bookingLink: null,
			software: [],
		}),
		"send",
	);
}
