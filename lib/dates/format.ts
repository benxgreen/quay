import { assertIsoDate, type IsoDate } from "@/lib/dates/working-days";

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
	weekday: "long",
	day: "numeric",
	month: "long",
	timeZone: "UTC",
});

const LONG_DATE_WITH_YEAR = new Intl.DateTimeFormat("en-GB", {
	weekday: "long",
	day: "numeric",
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

/** "Tuesday 17 November", or "Tuesday 17 November 2026" with `year`. */
export function formatLongDate(day: IsoDate, { year = false }: { year?: boolean } = {}): string {
	const date = new Date(`${assertIsoDate(day)}T00:00:00Z`);
	return (year ? LONG_DATE_WITH_YEAR : LONG_DATE).format(date).replace(",", "");
}

/**
 * A time of day in GOV.UK style: "9:30am", "10am", "midday", "midnight".
 * Takes the database's "HH:MM" or "HH:MM:SS".
 */
export function formatTime(time: string): string {
	const match = time.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
	if (!match) throw new Error(`Not a time: ${time}`);
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) throw new Error(`Not a time: ${time}`);

	if (minutes === 0 && hours === 12) return "midday";
	if (minutes === 0 && hours === 0) return "midnight";
	const hour = hours % 12 === 0 ? 12 : hours % 12;
	const suffix = hours < 12 ? "am" : "pm";
	return minutes === 0 ? `${hour}${suffix}` : `${hour}:${match[2]}${suffix}`;
}
