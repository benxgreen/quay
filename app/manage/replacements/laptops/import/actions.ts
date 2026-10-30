"use server";

import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import {
	addToQueue,
	getUserDetails,
	refreshReport,
	type UserDetails,
} from "@/services/replacements/laptops/lib/import";
import {
	changeQueuedType,
	moveToFront,
	removeFromQueue,
} from "@/services/replacements/laptops/lib/queue";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

const BASE = LAPTOPS_SECTIONS.import.href;
const QUEUE = `${BASE}/queue`;

/** "Refresh from Halo", back to the tab it was pressed on. */
export async function refreshFromHalo(formData: FormData) {
	const user = await requireRole(ACCESS.laptops);
	const back = safeReturnTo(String(formData.get("returnTo") ?? "")) ?? BASE;
	const result = await refreshReport(user.id);
	if (!result.ok) {
		redirect(
			`${back}?refreshFailed=${encodeURIComponent(result.failure.message.slice(0, 200))}`,
		);
	}
	redirect(back);
}

/** "Add N to invitation queue". */
export async function addSelectedToQueue(formData: FormData) {
	const user = await requireRole(ACCESS.laptops);
	const assetIds = formData.getAll("asset").map(String);
	const type = String(formData.get("type") ?? "");
	if (assetIds.length === 0) redirect(`${BASE}?error=select`);
	if (type !== "collection" && type !== "session") redirect(`${BASE}?error=type`);

	const result = await addToQueue(assetIds, type, user.id);
	if (!result.ok) redirect(`${BASE}?error=select`);
	redirect(`${BASE}?added=${result.cases.map((c) => c.id).join(",")}`);
}

/** The user details dialog's data, read from Halo when it opens. */
export async function loadUserDetails(email: string): Promise<UserDetails> {
	const user = await requireRole(ACCESS.laptops);
	return getUserDetails(email, user.id);
}

export async function moveCaseToFront(caseId: string) {
	const user = await requireRole(ACCESS.laptops);
	const moved = await moveToFront(caseId, user.id);
	redirect(moved ? `${QUEUE}?moved=${caseId}` : QUEUE);
}

export type ChangeTypeState = { error?: string };

export async function changeCaseType(
	caseId: string,
	_state: ChangeTypeState,
	formData: FormData,
): Promise<ChangeTypeState> {
	const user = await requireRole(ACCESS.laptops);
	const type = String(formData.get("type") ?? "");
	if (type !== "collection" && type !== "session") return { error: "Select a type" };
	const changed = await changeQueuedType(caseId, type, user.id);
	redirect(changed ? `${QUEUE}?typeChanged=${caseId}` : QUEUE);
}

export async function removeCaseFromQueue(caseId: string) {
	const user = await requireRole(ACCESS.laptops);
	const removed = await removeFromQueue(caseId, user.id);
	redirect(removed ? `${QUEUE}?removed=${caseId}` : QUEUE);
}
