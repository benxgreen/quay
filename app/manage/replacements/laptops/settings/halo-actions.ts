"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import type { FormState } from "@/lib/forms/state";
import { ACCESS } from "@/lib/portal/access";
import {
	type LaptopHaloSettings,
	saveLaptopHaloSettings,
} from "@/services/replacements/laptops/lib/halo/settings";
import { variableNames } from "@/services/replacements/laptops/lib/variables";
import { SETTINGS } from "./definitions";

/** A chosen ID: a whole number, or null when "None" was chosen and that's allowed. */
function readId(raw: string, { optional = false } = {}): number | null | undefined {
	if (!raw) return optional ? null : undefined;
	return /^\d+$/.test(raw) ? Number(raw) : undefined;
}

function done(): never {
	redirect(`${SETTINGS}?saved=halo#halo`);
}

/** Settings › Halo › Reports. */
export async function saveHaloReportsAction(
	_state: FormState,
	formData: FormData,
): Promise<FormState> {
	const user = await requireRole(ACCESS.laptopsSettings);
	const field = (name: string) => String(formData.get(name) ?? "");
	const values = { eligible: field("eligible"), stock: field("stock"), ids: field("ids") };
	const eligible = readId(values.eligible);
	if (eligible == null)
		return {
			values,
			errors: { eligible: "Select the report of laptops eligible for replacement" },
		};
	await saveLaptopHaloSettings(
		{
			eligibleReportId: eligible,
			stockReportId: readId(values.stock, { optional: true }) ?? null,
			idsReportId: readId(values.ids, { optional: true }) ?? null,
		},
		user.actorId,
	);
	done();
}

const REQUIRED: { key: keyof LaptopHaloSettings; label: string }[] = [
	{ key: "laptopTypeId", label: "the laptop asset type" },
	{ key: "statusInStock", label: "the in stock status" },
	{ key: "statusInService", label: "the in service status" },
	{ key: "statusOutOfService", label: "the out of service status" },
	{ key: "fieldSerial", label: "the serial number field" },
	{ key: "fieldStockLocation", label: "the stock location field" },
	{ key: "fieldStockRoom", label: "the stock room field" },
	{ key: "fieldLastAuditDate", label: "the last audit date field" },
	{ key: "fieldAuditDetails", label: "the audit details field" },
	{ key: "locationDecommissioned", label: "the stock location for a decommissioned laptop" },
	{ key: "roomReturned", label: "the stock room for a returned laptop" },
];

/** Settings › Halo › Laptops: asset type, statuses, fields and values. */
export async function saveHaloLaptopsAction(
	_state: FormState,
	formData: FormData,
): Promise<FormState> {
	const user = await requireRole(ACCESS.laptopsSettings);
	const values = Object.fromEntries(
		[...REQUIRED.map((r) => r.key), "fieldLastSync"].map((key) => [
			key,
			String(formData.get(key) ?? ""),
		]),
	);
	const errors: Record<string, string> = {};
	const changes: Partial<LaptopHaloSettings> = {};
	for (const { key, label } of REQUIRED) {
		const id = readId(values[key]);
		if (id == null) errors[key] = `Select ${label}`;
		else (changes as Record<string, number>)[key] = id;
	}
	changes.fieldLastSync = readId(values.fieldLastSync, { optional: true }) ?? null;
	if (Object.keys(errors).length) return { values, errors };
	await saveLaptopHaloSettings(changes, user.actorId);
	done();
}

/** Settings › Halo › Audit notes: the wording written to Audit Details. */
export async function saveHaloNotesAction(
	_state: FormState,
	formData: FormData,
): Promise<FormState> {
	const user = await requireRole(ACCESS.laptopsSettings);
	const values = {
		collectedNote: String(formData.get("collectedNote") ?? "").trim(),
		returnedNote: String(formData.get("returnedNote") ?? "").trim(),
	};
	const errors: Record<string, string> = {};
	for (const [key, label] of [
		["collectedNote", "when a new laptop is collected"],
		["returnedNote", "when an old laptop is returned"],
	] as const) {
		const note = values[key];
		const unknown = [...note.matchAll(/\{([^}]*)\}/g)]
			.map((m) => m[1])
			.filter((name) => !variableNames("audit").includes(name));
		if (!note) errors[key] = `Enter the note ${label}`;
		else if (note.length > 200) errors[key] = "Note must be 200 characters or fewer";
		else if (unknown.length)
			errors[key] =
				`{${unknown[0]}} can't be used here. Open "Available variables" to see the ones that can`;
	}
	if (Object.keys(errors).length) return { values, errors };
	await saveLaptopHaloSettings(values, user.actorId);
	done();
}
