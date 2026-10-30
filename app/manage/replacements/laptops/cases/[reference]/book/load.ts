import "server-only";

import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { getCase } from "@/services/replacements/laptops/lib/cases";
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
