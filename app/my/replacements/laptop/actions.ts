"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import {
	AVAILABILITY_REASONS,
	type AvailabilityReason,
	bookSession,
	changeSoftware,
	cleanSoftware,
	notAvailable,
	offeredSessions,
	rebook,
	requestAvailability,
	softwareList,
} from "@/services/replacements/laptops/lib/booking";
import { myCase } from "@/services/replacements/laptops/lib/my-laptop";
import { LAPTOP_PAGE, withCase } from "./wording";

/** The signed-in person's case, or back to their laptop page. */
async function mine(formData: FormData) {
	const user = await requireUser();
	const token = String(formData.get("case") ?? "") || undefined;
	const found = await myCase(user.id, token);
	if (!found) redirect(LAPTOP_PAGE);
	return { user, found, token };
}

/** A session the colleague may book now: offered to them and not full. */
async function bookable(
	type: "collection" | "session",
	sessionId: string,
	exclude?: string | null,
) {
	const weeks = await offeredSessions(type, { exclude });
	return weeks.flatMap((week) => week.sessions).find((session) => session.id === sessionId);
}

async function software(formData: FormData) {
	const list = await softwareList();
	return cleanSoftware(
		formData.getAll("software").map(String),
		formData.getAll("other").map(String),
		list,
	);
}

/** Choose a date and time → What software do you need? */
export async function chooseDate(formData: FormData) {
	const { found, token } = await mine(formData);
	const sessionId = String(formData.get("session") ?? "");
	if (!sessionId) redirect(`${LAPTOP_PAGE}/book${withCase(token, { error: "choose" })}`);
	const session = await bookable(found.type, sessionId);
	if (!session || session.placesLeft <= 0) {
		redirect(`${LAPTOP_PAGE}/book${withCase(token, { error: "full", session: sessionId })}`);
	}
	redirect(
		`${LAPTOP_PAGE}/book/software${withCase(token, { session: sessionId, software: formData.getAll("keep").map(String) })}`,
	);
}

/** What software do you need? → Check your answers. */
export async function chooseSoftware(formData: FormData) {
	const { token } = await mine(formData);
	const sessionId = String(formData.get("session") ?? "");
	redirect(
		`${LAPTOP_PAGE}/book/check${withCase(token, { session: sessionId, software: await software(formData) })}`,
	);
}

/** Confirm booking. The place is checked again as it is saved. */
export async function confirmBooking(formData: FormData) {
	const { user, found, token } = await mine(formData);
	const sessionId = String(formData.get("session") ?? "");
	const chosen = formData.getAll("software").map(String);
	const session = await bookable(found.type, sessionId);
	if (!session || session.placesLeft <= 0) {
		redirect(`${LAPTOP_PAGE}/book${withCase(token, { error: "full", session: sessionId })}`);
	}
	const result = await bookSession(
		found.id,
		sessionId,
		cleanSoftware(chosen, [], await softwareList()),
		{
			userId: user.actorId,
			onBehalf: false,
		},
	);
	if (!result.ok && result.reason === "full") {
		redirect(`${LAPTOP_PAGE}/book${withCase(token, { error: "full", session: sessionId })}`);
	}
	redirect(`${LAPTOP_PAGE}${withCase(token, result.ok ? { done: "booked" } : {})}`);
}

/** Choose a new date and time, or "I am not available for any of these dates". */
export async function chooseNewDate(formData: FormData) {
	const { user, found, token } = await mine(formData);
	const choice = String(formData.get("session") ?? "");
	if (!choice) redirect(`${LAPTOP_PAGE}/rebook${withCase(token, { error: "choose" })}`);
	if (choice === "not-available") {
		await notAvailable(found.id, user.actorId);
		redirect(`/my${withCase(token)}`);
	}
	const session = await bookable(found.type, choice, found.booking?.sessionId);
	if (!session || session.placesLeft <= 0) {
		redirect(`${LAPTOP_PAGE}/rebook${withCase(token, { error: "full", session: choice })}`);
	}
	const result = await rebook(found.id, choice, { userId: user.actorId, onBehalf: false });
	if (!result.ok && result.reason === "full") {
		redirect(`${LAPTOP_PAGE}/rebook${withCase(token, { error: "full", session: choice })}`);
	}
	redirect(`${LAPTOP_PAGE}${withCase(token, result.ok ? { done: "rebooked" } : {})}`);
}

export async function saveMySoftware(formData: FormData) {
	const { user, found, token } = await mine(formData);
	const result = await changeSoftware(found.id, await software(formData), {
		userId: user.actorId,
		onBehalf: false,
	});
	redirect(`${LAPTOP_PAGE}${withCase(token, result.ok ? { done: "software" } : {})}`);
}

/** Tell us when you are available. */
export async function sendAvailability(formData: FormData) {
	const { user, found, token } = await mine(formData);
	const reason = String(formData.get("reason") ?? "");
	const text = (name: string) =>
		String(formData.get(name) ?? "")
			.trim()
			.slice(0, 1000);
	if (!(reason in AVAILABILITY_REASONS))
		redirect(`${LAPTOP_PAGE}/availability${withCase(token, { error: "reason" })}`);
	const availability =
		reason === "non_standard_hours"
			? text("hours")
			: reason === "other"
				? text("why")
				: "Away for all of the dates offered.";
	if (!availability) redirect(`${LAPTOP_PAGE}/availability${withCase(token, { error: reason })}`);
	await requestAvailability(
		found.id,
		{ reason: reason as AvailabilityReason, availability, software: await software(formData) },
		user.actorId,
	);
	redirect(`${LAPTOP_PAGE}/availability/sent${withCase(token)}`);
}
