"use server";

import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { londonToday } from "@/lib/clock";
import { ACCESS } from "@/lib/portal/access";
import {
	bookCustomAppointment,
	bookSession,
	changeSoftware,
	cleanSoftware,
	rebook,
	softwareList,
} from "@/services/replacements/laptops/lib/booking";
import { getCase } from "@/services/replacements/laptops/lib/cases";
import { validateSessionForm } from "@/services/replacements/laptops/lib/session-form";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

const BASE = LAPTOPS_SECTIONS.cases.href;

async function load(reference: string) {
	const user = await requireRole(ACCESS.laptops);
	const detail = await getCase(reference);
	if (!detail || detail.archived) notFound();
	return { user, detail, back: `${BASE}/${reference}` };
}

/**
 * Back to the date page with what went wrong: the date filled up, or the
 * case can no longer be booked (someone else booked it, or its status
 * changed), which must not be reported as a full date.
 */
function bookError(back: string, reason: "full" | "not_allowed", session: string): string {
	return reason === "full"
		? `${back}/book?error=full&session=${session}`
		: `${back}/book?error=not_allowed`;
}

async function chosenSoftware(formData: FormData) {
	const list = await softwareList();
	const listed = formData.getAll("software").map(String);
	return cleanSoftware(listed, formData.getAll("other").map(String), list);
}

/** Choose a date. A booked case is rebooked straight away. */
export async function teamChooseDate(reference: string, formData: FormData) {
	const { user, detail, back } = await load(reference);
	const session = String(formData.get("session") ?? "");
	if (!session) redirect(`${back}/book?error=choose`);
	if (detail.booking) {
		const result = await rebook(detail.id, session, { userId: user.actorId, onBehalf: true });
		if (!result.ok) redirect(bookError(back, result.reason, session));
		redirect(`${back}?done=rebooked`);
	}
	redirect(`${back}/book/software?session=${session}`);
}

export async function teamChooseSoftware(reference: string, formData: FormData) {
	const { back } = await load(reference);
	const params = new URLSearchParams({ session: String(formData.get("session") ?? "") });
	for (const name of await chosenSoftware(formData)) params.append("software", name);
	redirect(`${back}/book/check?${params}`);
}

/** Book collection / Book session, with or without the confirmation email. */
export async function teamConfirmBooking(reference: string, formData: FormData) {
	const { user, detail, back } = await load(reference);
	const session = String(formData.get("session") ?? "");
	const software = formData.getAll("software").map(String);
	const email = formData.get("email") === "yes";
	const result = await bookSession(
		detail.id,
		session,
		software,
		{ userId: user.actorId, onBehalf: true },
		{ email },
	);
	if (!result.ok) redirect(bookError(back, result.reason, session));
	redirect(`${back}?done=booked`);
}

/** The team changes software, recorded as an override after the lock. */
export async function teamChangeSoftware(reference: string, formData: FormData) {
	const { user, detail, back } = await load(reference);
	const software = await chosenSoftware(formData);
	await changeSoftware(detail.id, software, { userId: user.actorId, onBehalf: true });
	redirect(`${back}?done=software`);
}

export type CustomState = { errors?: Record<string, string>; values?: Record<string, string> };

export async function teamCustomAppointment(
	reference: string,
	_s: CustomState,
	formData: FormData,
): Promise<CustomState> {
	const { user, detail, back } = await load(reference);
	const f = (name: string) => String(formData.get(name) ?? "");
	const values = {
		day: f("date-day"),
		month: f("date-month"),
		year: f("date-year"),
		hour: f("time-hour"),
		minute: f("time-minute"),
		location: f("location"),
		note: f("note"),
	};
	const checked = validateSessionForm(
		{ ...values, type: "collection", capacity: "1" },
		{ today: londonToday() },
	);
	if (!checked.ok) {
		const { date, time, location } = checked.errors;
		const errors = Object.fromEntries(
			Object.entries({ date, time, location }).filter(([, v]) => v),
		) as Record<string, string>;
		return { errors, values };
	}
	const { date, time, location } = checked.input;
	const note = values.note.trim().slice(0, 500);
	const saved = await bookCustomAppointment(
		detail.id,
		{ date, time, location, note },
		user.actorId,
	);
	if (!saved)
		return { errors: { date: "This case can’t have a custom appointment now" }, values };
	redirect(`${back}?done=custom`);
}
