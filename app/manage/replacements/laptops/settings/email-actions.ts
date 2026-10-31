"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { checkEmailFields } from "@/lib/emails/validate";
import type { FormState } from "@/lib/forms/state";
import { ACCESS } from "@/lib/portal/access";
import { LAPTOP_EMAIL_VARIABLE_NAMES } from "@/services/replacements/laptops/lib/emails";
import {
	isLaptopEmailKey,
	saveEmailSender,
	saveEmailTemplate,
	sendTestEmail,
} from "@/services/replacements/laptops/lib/emails/settings";
import { SETTINGS } from "./definitions";

/** Save an email, or send it as written to the person editing it. */
export async function saveEmailAction(
	key: string,
	_state: FormState,
	formData: FormData,
): Promise<FormState> {
	const user = await requireRole(ACCESS.laptopsSettings);
	if (!isLaptopEmailKey(key)) redirect(SETTINGS);
	const field = (name: string) => String(formData.get(name) ?? "");
	const values = {
		subject: field("subject").trim(),
		preheader: field("preheader").trim(),
		body: field("body").replace(/\r\n/g, "\n").trim(),
	};
	const errors = checkEmailFields(values, LAPTOP_EMAIL_VARIABLE_NAMES);
	if (Object.keys(errors).length) return { values, errors };

	const template = {
		subject: values.subject,
		preheader: values.preheader,
		bodyMarkdown: values.body,
	};
	if (formData.get("intent") === "test") {
		// While impersonating, the test goes to the Administrator, not the person.
		const to = user.impersonator?.email ?? user.email;
		const sent = await sendTestEmail(key, template, to, user.actorId);
		return {
			values,
			errors: {},
			test: sent.ok
				? {
						ok: true,
						message: `A test has been sent to ${to}. It is not saved yet.`,
					}
				: { ok: false, message: `The test could not be sent: ${sent.message}` },
		};
	}
	await saveEmailTemplate(key, template, user.actorId);
	redirect(`${SETTINGS}?saved=email#emails`);
}

/** Team name or Sent from, under Settings › Emails. */
export async function saveSenderAction(
	field: "team" | "from",
	_state: FormState,
	formData: FormData,
): Promise<FormState> {
	const user = await requireRole(ACCESS.laptopsSettings);
	const value = String(formData.get("value") ?? "").trim();
	const values = { value };
	if (field === "team") {
		if (!value) return { values, errors: { value: "Enter the team name" } };
		if (value.length > 100)
			return { values, errors: { value: "Team name must be 100 characters or fewer" } };
		await saveEmailSender({ teamName: value }, user.actorId);
	} else {
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
			return {
				values,
				errors: {
					value: "Enter an email address in the correct format, like name@bcpcouncil.gov.uk",
				},
			};
		}
		await saveEmailSender({ sentFrom: value.toLowerCase() }, user.actorId);
	}
	redirect(`${SETTINGS}?saved=sender#emails`);
}
