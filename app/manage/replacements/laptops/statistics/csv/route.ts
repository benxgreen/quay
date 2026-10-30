import { requireRole } from "@/lib/auth/guards";
import { londonToday } from "@/lib/clock";
import { WORKING_WEEKDAYS } from "@/lib/dates/working-days";
import { ACCESS } from "@/lib/portal/access";
import { csvHeaders, toCsv } from "@/lib/utils/csv";
import { getStatistics } from "@/services/replacements/laptops/lib/statistics";
import { readFilters } from "../filters";

export const dynamic = "force-dynamic";

/** "Download as CSV": the same figures as the page, for its period and type. */
export async function GET(request: Request) {
	await requireRole(ACCESS.laptops);
	const params = Object.fromEntries(new URL(request.url).searchParams);
	const filters = readFilters(params, londonToday());
	const stats = await getStatistics(filters);

	const rows: (string | number)[][] = [
		["Section", "Item", "Value"],
		["Period", "From", filters.from],
		["Period", "To", filters.to],
		["Period", "Type", filters.type || "all"],
		["Headline", "Laptops in stock (available)", stats.stock?.available ?? ""],
		["Headline", "Laptops allocated to cases", stats.stock?.allocated ?? ""],
		["Headline", "Sessions held", stats.sessionsHeld],
		["Headline", "Replacements completed", stats.replacementsCompleted],
		["Headline", "Awaiting old device (now)", stats.awaitingReturn],
		["Headline", "Bookings", stats.bookings],
		...stats.software.listed.map((row) => ["Software requested", row.name, row.count]),
		...stats.software.typed.map((row) => ["Software typed in", row.name, row.count]),
		...stats.weekdays.map((row) => [
			"Bookings by weekday",
			WORKING_WEEKDAYS[row.weekday - 1],
			row.count,
		]),
		...stats.sessions.flatMap((row) => [
			[`Sessions: ${row.type}`, "Held", row.held],
			[`Sessions: ${row.type}`, "Places offered", row.offered],
			[`Sessions: ${row.type}`, "Booked", row.booked],
			[`Sessions: ${row.type}`, "Did not attend", row.didNotAttend],
		]),
	];
	const csv = toCsv(rows);
	return new Response(csv, {
		headers: csvHeaders(`laptop-replacement-statistics-${filters.from}-to-${filters.to}.csv`),
	});
}
