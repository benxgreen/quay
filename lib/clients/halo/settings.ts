import "server-only";

import { query, queryOne } from "@/lib/db/query";

/**
 * Which Halo user field gives each staff detail (Portal settings › Halo).
 * The username isn't one: it will come from Entra ID, which has the domain
 * prefix (such as bcp\ben.green) that Halo doesn't.
 * A field is named by its Halo property, such as "samaccountname", or as
 * "custom:<id>" for a custom field. Null when the portal doesn't read it.
 */
export type HaloUserFieldMap = {
	jobTitleField: string | null;
	departmentField: string | null;
	managerEmailField: string | null;
	lastSignInField: string | null;
};

/** The staff details that can be mapped, in the order the settings page shows them. */
export const STAFF_FIELDS = [
	{ key: "jobTitleField", label: "Job title" },
	{ key: "departmentField", label: "Department" },
	{ key: "managerEmailField", label: "Manager's email address" },
	{ key: "lastSignInField", label: "Last sign-in" },
] as const satisfies readonly { key: keyof HaloUserFieldMap; label: string; hint?: string }[];

export async function getHaloUserFieldMap(): Promise<HaloUserFieldMap> {
	const row = await queryOne<HaloUserFieldMap>(
		`SELECT job_title_field AS "jobTitleField", department_field AS "departmentField",
		        manager_email_field AS "managerEmailField", last_sign_in_field AS "lastSignInField"
		 FROM portal.halo_settings WHERE id = 1`,
	);
	if (!row) throw new Error("The portal's Halo settings are missing");
	return row;
}

export async function saveHaloUserFieldMap(map: HaloUserFieldMap, actorId: string): Promise<void> {
	await query(
		`UPDATE portal.halo_settings
		 SET job_title_field = $1, department_field = $2, manager_email_field = $3,
		     last_sign_in_field = $4, updated_by = $5, updated_at = now()
		 WHERE id = 1`,
		[
			map.jobTitleField,
			map.departmentField,
			map.managerEmailField,
			map.lastSignInField,
			actorId,
		],
	);
}

export { readHaloField } from "./fields";
