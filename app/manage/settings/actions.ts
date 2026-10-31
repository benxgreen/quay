"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { testHaloConnection } from "@/lib/clients/halo/discover";
import { STAFF_FIELDS, saveHaloUserFieldMap } from "@/lib/clients/halo/settings";
import { checkTemplateHtml } from "@/lib/emails/validate";
import type { FormState } from "@/lib/forms/state";
import { ACCESS } from "@/lib/portal/access";
import { saveConnectionUrl } from "@/lib/portal/connections";
import { savePortalEmailTemplate } from "@/lib/portal/email-template";

/** portal Settings: the email template every service's emails use. Administrator users only. */
export async function savePortalTemplateAction(
	_state: FormState,
	formData: FormData,
): Promise<FormState> {
	const user = await requireRole(ACCESS.management);
	const html = String(formData.get("html") ?? "").replace(/\r\n/g, "\n");
	const error = checkTemplateHtml(html);
	if (error) return { values: { html }, errors: { html: error } };
	await savePortalEmailTemplate(html, user.actorId);
	redirect("/manage/settings?saved=template");
}

/**
 * A new link for a connection (portal.connections, used by every service).
 * Administrator users only. `returnTo` is the settings page it was changed
 * from, which shows the success banner.
 */
export async function saveConnectionAction(
	key: string,
	returnTo: string,
	_state: FormState,
	formData: FormData,
): Promise<FormState> {
	const user = await requireRole(ACCESS.management);
	const value = String(formData.get("value") ?? "").trim();
	const values = { value };
	let url: URL | null = null;
	try {
		url = new URL(value);
	} catch {
		// Checked below.
	}
	if (!value) return { values, errors: { value: "Enter the link" } };
	if (url?.protocol !== "https:") {
		return { values, errors: { value: "Enter a full link that starts with https://" } };
	}
	if (!(await saveConnectionUrl(key, value, user.actorId))) redirect(returnTo);
	redirect(`${returnTo}?saved=connection#${key === "halo" ? "halo" : "connections"}`);
}

/** "Test connection": signs in to Halo and reads one user, then reports back on portal Settings. */
export async function testHaloConnectionAction() {
	const user = await requireRole(ACCESS.management);
	let result: string;
	try {
		const { value } = await testHaloConnection({
			trigger: { kind: "user", label: "Test Halo connection", actorUserId: user.actorId },
		});
		result = `ok&users=${value.users}`;
	} catch (error) {
		result = `failed&message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`;
	}
	redirect(`/manage/settings?tested=${result}#halo`);
}

/** portal Settings › Halo › Staff fields: which Halo user field gives each staff detail. */
export async function saveHaloStaffFieldsAction(
	_state: FormState,
	formData: FormData,
): Promise<FormState> {
	const user = await requireRole(ACCESS.management);
	const field = (name: string) => String(formData.get(name) ?? "").trim();
	const values = Object.fromEntries(STAFF_FIELDS.map((f) => [f.key, field(f.key)]));
	const valid = /^(custom:\d+|[a-z_][a-z0-9_]*)$/i;
	for (const { key, label } of STAFF_FIELDS) {
		if (values[key] && !valid.test(values[key])) {
			return {
				values,
				errors: { [key]: `Select the Halo field for ${label.toLowerCase()}` },
			};
		}
	}
	await saveHaloUserFieldMap(
		{
			jobTitleField: values.jobTitleField || null,
			departmentField: values.departmentField || null,
			managerEmailField: values.managerEmailField || null,
			lastSignInField: values.lastSignInField || null,
		},
		user.actorId,
	);
	redirect("/manage/settings?saved=staff-fields#halo");
}
