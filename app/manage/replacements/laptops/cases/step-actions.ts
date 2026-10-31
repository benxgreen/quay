"use server";

import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { getCase } from "@/services/replacements/laptops/lib/cases";
import {
	allocateDevice,
	type ChecklistName,
	completeReplacement,
	decommission,
	markReturned,
	reopenStep,
	type StepResult,
	saveDecommission,
	savePreparation,
	saveReturnReminders,
	saveSoftware,
	unallocateDevice,
	updateChecklist,
} from "@/services/replacements/laptops/lib/steps";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

/**
 * The case page's step forms. Each goes back to the case with a banner:
 * ?step= on success, ?stepError= for something to fix, or ?failed= with
 * Halo's message when an external call failed (nothing changed).
 */
async function run(
	reference: string,
	failedAction: string,
	work: (
		detail: NonNullable<Awaited<ReturnType<typeof getCase>>>,
		actorId: string,
	) => Promise<StepResult>,
	done: string,
) {
	const user = await requireRole(ACCESS.laptops);
	const detail = await getCase(reference);
	if (!detail) notFound();
	const result = await work(detail, user.actorId);
	const back = `${LAPTOPS_SECTIONS.cases.href}/${reference}`;
	if (result.ok) redirect(`${back}?step=${done}#steps`);
	if ("failure" in result) {
		const params = new URLSearchParams({
			failed: failedAction,
			message: result.failure.message.slice(0, 200),
			at: result.failure.at.toISOString(),
		});
		redirect(`${back}?${params}`);
	}
	redirect(`${back}?stepError=${encodeURIComponent(result.error)}#steps`);
}

const ticks = (formData: FormData, name: string) => formData.getAll(name).map(String);
const intent = (formData: FormData) => formData.get("intent") === "confirm";

export async function allocateAction(reference: string, formData: FormData) {
	await run(
		reference,
		"allocate",
		(d, a) => allocateDevice(d, String(formData.get("box") ?? ""), a),
		"allocated",
	);
}

export async function unallocateAction(reference: string, formData: FormData) {
	const reason = String(formData.get("reason") ?? "")
		.trim()
		.slice(0, 500);
	await run(reference, "unallocate", (d, a) => unallocateDevice(d, reason, a), "unallocated");
}

export async function preparationAction(reference: string, formData: FormData) {
	const confirm = intent(formData);
	await run(
		reference,
		"preparation",
		(d, a) => savePreparation(d, ticks(formData, "check"), confirm, a),
		confirm ? "prepared" : "prep-saved",
	);
}

export async function softwareAction(reference: string, formData: FormData) {
	const confirm = intent(formData);
	await run(
		reference,
		"software",
		(d, a) => saveSoftware(d, ticks(formData, "software"), confirm, a),
		confirm ? "software-prepared" : "software-saved",
	);
}

export async function reopenAction(reference: string, step: 2 | 3) {
	await run(reference, "reopen", (d, a) => reopenStep(d, step, a), `reopened-${step}`);
}

export async function updateChecklistAction(reference: string, list: ChecklistName) {
	await run(
		reference,
		"update-checklist",
		(d, a) => updateChecklist(d, list, a),
		"checklist-updated",
	);
}

export async function completeAction(reference: string) {
	await run(reference, "complete", completeReplacement, "completed");
}

export async function remindersAction(reference: string, formData: FormData) {
	const on = formData.get("reminders") === "on";
	await run(reference, "reminders", (d, a) => saveReturnReminders(d, on, a), "reminders-saved");
}

export async function returnedAction(reference: string, formData: FormData) {
	const field = (name: string) => String(formData.get(name) ?? "").trim();
	const [day, month, year] = [
		field("returned-day"),
		field("returned-month"),
		field("returned-year"),
	];
	const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	const real =
		/^\d{4}-\d{2}-\d{2}$/.test(date) &&
		!Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
		new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
	await run(
		reference,
		"returned",
		(d, a) =>
			real
				? markReturned(d, date, a)
				: Promise.resolve({ ok: false, error: "Enter a real date returned" }),
		"returned",
	);
}

export async function decommissionAction(reference: string, formData: FormData) {
	const confirm = intent(formData);
	await run(
		reference,
		"decommission",
		(d, a) =>
			confirm
				? decommission(d, ticks(formData, "check"), a)
				: saveDecommission(d, ticks(formData, "check"), a),
		confirm ? "decommissioned" : "decom-saved",
	);
}
