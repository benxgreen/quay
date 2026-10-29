import { assertIsoDate, type IsoDate } from "@/lib/dates/working-days";

const londonDate = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/London",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** Today's date in Europe/London as YYYY-MM-DD. */
export function londonToday(now: Date = new Date()): IsoDate {
	return londonDate.format(now);
}

/**
 * The date a job or rule should treat as today. In development a job can be
 * run "as if today is" another date; the date is passed to queries rather
 * than changing the database clock. Outside development the override is
 * refused.
 *
 * @example
 * const today = resolveToday(searchParams.get("asOf") ?? undefined);
 */
export function resolveToday(asOf?: string, now: Date = new Date()): IsoDate {
	if (asOf === undefined || asOf === "") {
		return londonToday(now);
	}
	if (process.env.NODE_ENV === "production") {
		throw new Error("Running as if today is another date is only allowed in development");
	}
	return assertIsoDate(asOf);
}
