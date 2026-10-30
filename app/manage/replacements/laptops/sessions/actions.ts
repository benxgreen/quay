"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { resolveToday } from "@/lib/clock";
import { describeConstraintError } from "@/lib/db/errors";
import { ACCESS } from "@/lib/portal/access";
import {
	type SessionFormErrors,
	type SessionFormValues,
	validateSessionForm,
} from "@/services/replacements/laptops/lib/session-form";
import {
	cancelSession,
	createSession,
	getSession,
	updateSession,
} from "@/services/replacements/laptops/lib/sessions";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

const BASE = LAPTOPS_SECTIONS.sessions.href;

export type SessionFormState = { values?: SessionFormValues; errors?: SessionFormErrors };

/** Add a session (sessionId null) or save an edited one. */
export async function saveSession(
	sessionId: string | null,
	_state: SessionFormState,
	formData: FormData,
): Promise<SessionFormState> {
	const user = await requireRole(ACCESS.laptops);
	const field = (name: string) => String(formData.get(name) ?? "");
	const values: SessionFormValues = {
		type: field("type"),
		day: field("date-day"),
		month: field("date-month"),
		year: field("date-year"),
		hour: field("time-hour"),
		minute: field("time-minute"),
		capacity: field("capacity"),
		location: field("location"),
	};

	const existing = sessionId ? await getSession(sessionId) : null;
	if (sessionId && (!existing || existing.cancelled)) redirect(BASE);

	const result = validateSessionForm(values, {
		today: resolveToday(),
		existing: existing ? { type: existing.type, booked: existing.booked } : undefined,
	});
	if (!result.ok) return { values, errors: result.errors };

	if (sessionId) {
		try {
			await updateSession(sessionId, result.input, user.id);
		} catch (error) {
			const constraint = describeConstraintError(error);
			if (constraint?.problem === "session_duplicate") {
				return { values, errors: { time: constraint.message } };
			}
			throw error;
		}
		redirect(`${BASE}/${sessionId}?saved=updated`);
	}
	let id: string;
	try {
		id = await createSession(result.input, user.id);
	} catch (error) {
		const constraint = describeConstraintError(error);
		if (constraint?.problem === "session_duplicate") {
			return { values, errors: { time: constraint.message } };
		}
		throw error;
	}
	redirect(`${BASE}/${id}?saved=added`);
}

/** "Cancel session" on the confirmation page. */
export async function confirmCancelSession(sessionId: string, formData: FormData) {
	const user = await requireRole(ACCESS.laptops);
	const reason = String(formData.get("reason") ?? "")
		.trim()
		.slice(0, 500);
	await cancelSession(sessionId, reason, user.id);
	redirect(`${BASE}/${sessionId}?cancelled=1`);
}
