import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { availableActions, getCase } from "@/services/replacements/laptops/lib/cases";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

/** The case for a team booking page, with its links. */
export async function loadForBooking(reference: string) {
	await requireRole(ACCESS.laptops);
	const detail = await getCase(reference);
	if (!detail || detail.archived) notFound();
	const href = `${LAPTOPS_SECTIONS.cases.href}/${reference}`;
	const crumbs = [LAPTOPS_SECTIONS.cases, { text: detail.person.name, href }];
	const caption = `Case ${detail.reference} · ${detail.person.name} · Book on behalf`;
	return { detail, href, crumbs, caption };
}

/**
 * The same, for the booking steps: a case with neither a booking to move
 * nor Book on behalf open to it (such as one already Booked) goes back to
 * the case page.
 */
export async function loadForNewBooking(reference: string) {
	const loaded = await loadForBooking(reference);
	const { detail, href } = loaded;
	if (!detail.booking && !availableActions(detail).includes("book-on-behalf")) redirect(href);
	return loaded;
}
