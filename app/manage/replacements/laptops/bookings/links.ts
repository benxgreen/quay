import type { BookingsFilters } from "@/services/replacements/laptops/lib/bookings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

export const BASE = LAPTOPS_SECTIONS.bookings.href;

/**
 * The dashboard's address with some filters changed, keeping the rest.
 * Defaults are left out, so the plain page is the Day view for today.
 */
export function bookingsHref(
	filters: BookingsFilters,
	today: string,
	changes: Partial<BookingsFilters> = {},
): string {
	const next = { ...filters, ...changes };
	const params = new URLSearchParams();
	if (next.view !== "day") params.set("view", next.view);
	if (next.date !== today) params.set("date", next.date);
	if (next.q) params.set("q", next.q);
	if (next.type) params.set("type", next.type);
	if (next.kind) params.set("kind", next.kind);
	if (next.deviceUnprepared) params.set("device", "1");
	if (next.softwareUnprepared) params.set("software", "1");
	if (next.past && next.view === "all") params.set("past", "1");
	const query = params.toString();
	return query ? `${BASE}?${query}` : BASE;
}
