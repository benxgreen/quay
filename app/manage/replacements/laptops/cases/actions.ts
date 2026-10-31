"use server";

import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import {
	type ActionResult,
	addNote,
	type CaseAction,
	cancelBooking,
	changeCaseType,
	clearFlag,
	flagCase,
	getCase,
	recordOutcome,
	resendBookingDetails,
	resendInvitation,
	withdrawCase,
} from "@/services/replacements/laptops/lib/cases";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

const BASE = LAPTOPS_SECTIONS.cases.href;

export async function addCaseNote(reference: string, formData: FormData) {
	const user = await requireRole(ACCESS.laptops);
	const detail = await getCase(reference);
	if (!detail || detail.archived) notFound();
	const note = String(formData.get("note") ?? "").trim();
	if (!note) redirect(`${BASE}/${reference}?noteError=empty#journal`);
	if (note.length > 2000) redirect(`${BASE}/${reference}?noteError=long#journal`);
	await addNote(detail, note, user.actorId);
	redirect(`${BASE}/${reference}#journal`);
}

export type CaseActionState = {
	error?: string;
	/** The field the error is about, for the error summary. */
	field?: string;
	/** An email didn't send: show the Failed banner. */
	emailFailed?: boolean;
};

/** Runs a case action from its confirmation page, then back to the case with a banner. */
export async function runCaseAction(
	reference: string,
	action: CaseAction,
	_state: CaseActionState,
	formData: FormData,
): Promise<CaseActionState> {
	const user = await requireRole(action === "withdraw" ? ACCESS.laptopsSettings : ACCESS.laptops);
	const detail = await getCase(reference);
	if (!detail) notFound();
	const text = (name: string) => String(formData.get(name) ?? "").trim();

	let result: ActionResult;
	switch (action) {
		case "resend-booking":
			result = await resendBookingDetails(detail, user.actorId);
			break;
		case "resend-invitation":
			result = await resendInvitation(detail, user.actorId);
			break;
		case "cancel-booking":
			result = await cancelBooking(detail, user.actorId);
			break;
		case "did-not-attend": {
			const outcome = text("outcome");
			if (outcome !== "did_not_attend" && outcome !== "unsuccessful") {
				return {
					error: `Select what happened at ${detail.person.firstName}’s session`,
					field: "outcome",
				};
			}
			result = await recordOutcome(
				detail,
				outcome,
				text("reason").slice(0, 500),
				user.actorId,
			);
			break;
		}
		case "flag": {
			const reason = text("reason");
			if (!reason) return { error: "Enter why you are flagging this case", field: "reason" };
			result = await flagCase(detail, reason.slice(0, 500), user.actorId);
			break;
		}
		case "clear-flag":
			result = await clearFlag(detail, user.actorId);
			break;
		case "change-type": {
			const type = text("type");
			if (type !== "collection" && type !== "session")
				return { error: "Select a type", field: "type" };
			result = await changeCaseType(detail, type, user.actorId);
			break;
		}
		case "book-on-behalf":
			redirect(`${BASE}/${reference}/book`);
			break;
		case "custom-appointment":
			redirect(`${BASE}/${reference}/custom-appointment`);
			break;
		case "withdraw": {
			const reason = text("reason");
			if (!reason) return { error: "Enter the reason for withdrawing", field: "reason" };
			result = await withdrawCase(detail, reason.slice(0, 500), user.actorId);
			break;
		}
	}

	if (!result.ok) return { error: result.error, emailFailed: result.emailFailed };
	redirect(`${BASE}/${reference}?done=${action}`);
}
