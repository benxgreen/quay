import { addDays, assertIsoDate, type IsoDate } from "@/lib/dates/working-days";

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

const LONDON_PARTS = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Europe/London",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Europe/London",
	day: "numeric",
	month: "short",
	year: "numeric",
});

/** The London date (YYYY-MM-DD) and time (HH:MM) of a moment. */
function londonParts(moment: Date): { day: string; time: string } {
	const parts = Object.fromEntries(
		LONDON_PARTS.formatToParts(moment).map((part) => [part.type, part.value]),
	);
	return {
		day: `${parts.year}-${parts.month}-${parts.day}`,
		time: `${parts.hour}:${parts.minute}`,
	};
}

/** "3 Sep 2026", in London time. */
export function formatShortDate(moment: Date): string {
	return SHORT_DATE.format(moment).replace("Sept", "Sep");
}

/**
 * When something happened, as the Users pages show it: "Today, 9:02am",
 * "Yesterday, 3:15pm", otherwise "10 Nov 2026". London time.
 */
export function formatWhen(moment: Date, now: Date = new Date()): string {
	const { day, time } = londonParts(moment);
	const today = londonParts(now).day;
	if (day === today) return `Today, ${formatTime(time)}`;
	if (day === addDays(today, -1)) return `Yesterday, ${formatTime(time)}`;
	return formatShortDate(moment);
}

const SHORT_DAY = new Intl.DateTimeFormat("en-GB", {
	weekday: "short",
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});

/** "Wed 11 Nov", or "Wed 11 Nov 2026" with `year`. */
export function formatShortDay(day: IsoDate, { year = false }: { year?: boolean } = {}): string {
	const text = SHORT_DAY.format(new Date(`${assertIsoDate(day)}T00:00:00Z`))
		.replace(",", "")
		.replace("Sept", "Sep");
	return year ? `${text} ${day.slice(0, 4)}` : text;
}

/** "November 2026" for a YYYY-MM month. */
export function formatMonth(month: string): string {
	const [year, number] = month.split("-");
	return `${new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
		new Date(Date.UTC(Number(year), Number(number) - 1, 1)),
	)} ${year}`;
}

const FULL_DATE = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Europe/London",
	day: "numeric",
	month: "long",
	year: "numeric",
});

/** "9 November 2026", in London time. */
export function formatFullDate(moment: Date): string {
	return FULL_DATE.format(moment);
}

/** "9 Nov 2026, 2:14pm", in London time. */
export function formatShortDateTime(moment: Date): string {
	return `${formatShortDate(moment)}, ${formatTime(londonParts(moment).time)}`;
}

/**
 * How long ago, for "Last seen": "Today", "Yesterday", "3 days ago",
 * "2 weeks ago", then the date ("8 Mar 2026"). London days.
 */
export function formatAgo(moment: Date, now: Date = new Date()): string {
	const day = londonParts(moment).day;
	const today = londonParts(now).day;
	const days = Math.round(
		(Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000,
	);
	if (days <= 0) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 14) return `${days} days ago`;
	if (days < 56) return `${Math.floor(days / 7)} weeks ago`;
	return formatShortDate(moment);
}

/** "9:14am today", "3:15pm yesterday" or "9:14am on 3 Nov 2026", for "Updated from Halo at …". */
export function formatUpdatedAt(moment: Date, now: Date = new Date()): string {
	const { day, time } = londonParts(moment);
	const today = londonParts(now).day;
	const at = formatTime(time);
	if (day === today) return `${at} today`;
	if (day === addDays(today, -1)) return `${at} yesterday`;
	return `${at} on ${formatShortDate(moment)}`;
}
