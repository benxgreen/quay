"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { checkTemplateHtml } from "@/lib/emails/validate";
import type { FormState } from "@/lib/forms/state";
import { ACCESS } from "@/lib/portal/access";
import { saveConnectionUrl } from "@/lib/portal/connections";
import { savePortalEmailTemplate } from "@/lib/portal/email-template";

/** Portal settings: the email template every service's emails use. Administrator users only. */
export async function savePortalTemplateAction(
	_state: FormState,
	formData: FormData,
): Promise<FormState> {
	const user = await requireRole(ACCESS.management);
	const html = String(formData.get("html") ?? "").replace(/\r\n/g, "\n");
	const error = checkTemplateHtml(html);
	if (error) return { values: { html }, errors: { html: error } };
	await savePortalEmailTemplate(html, user.id);
	redirect("/manage/portal-settings?saved=template");
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
	if (!(await saveConnectionUrl(key, value, user.id))) redirect(returnTo);
	redirect(`${returnTo}?saved=connection#connections`);
}
