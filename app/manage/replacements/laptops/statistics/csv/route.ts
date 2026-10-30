import { requireRole } from "@/lib/auth/guards";
import { londonToday } from "@/lib/clock";
import { ACCESS } from "@/lib/portal/access";
import { getStatistics } from "@/services/replacements/laptops/lib/statistics";
import { readFilters } from "../filters";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** A cell, quoted when it holds a comma, quote or line break, and never read as a formula. */
function cell(value: string | number): string {
	let text = String(value);
	if (/^[=+\-@]/.test(text)) text = `'${text}`;
	return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

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
			WEEKDAYS[row.weekday - 1],
			row.count,
		]),
		...stats.sessions.flatMap((row) => [
			[`Sessions: ${row.type}`, "Held", row.held],
			[`Sessions: ${row.type}`, "Places offered", row.offered],
			[`Sessions: ${row.type}`, "Booked", row.booked],
			[`Sessions: ${row.type}`, "Did not attend", row.didNotAttend],
		]),
	];
	const csv = `${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
	return new Response(csv, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="laptop-replacement-statistics-${filters.from}-to-${filters.to}.csv"`,
		},
	});
}
