"use server";

import { notFound, redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import {
	addDeviceNote,
	getDevice,
	getStockSnapshot,
	refreshStock,
} from "@/services/replacements/laptops/lib/stock";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

const BASE = LAPTOPS_SECTIONS.stock.href;

export async function refreshStockAction(formData: FormData) {
	const user = await requireRole(ACCESS.laptops);
	const back = safeReturnTo(String(formData.get("returnTo") ?? "")) ?? BASE;
	const result = await refreshStock(user.actorId);
	if (!result.ok)
		redirect(
			`${back}?refreshFailed=${encodeURIComponent(result.failure.message.slice(0, 200))}`,
		);
	redirect(back);
}

export async function addDeviceNoteAction(boxNumber: string, formData: FormData) {
	const user = await requireRole(ACCESS.laptops);
	if (!(await getDevice(boxNumber, await getStockSnapshot()))) notFound();
	const note = String(formData.get("note") ?? "").trim();
	const back = `${BASE}/${encodeURIComponent(boxNumber)}`;
	if (!note) redirect(`${back}?noteError=empty#journal`);
	if (note.length > 2000) redirect(`${back}?noteError=long#journal`);
	await addDeviceNote(boxNumber, note, user.actorId);
	redirect(`${back}#journal`);
}
