import { formatLongDate, formatShortDay, formatTime } from "@/lib/dates/format";
import type { IsoDate } from "@/lib/dates/working-days";

type When = { date: IsoDate; time: string };

/** "Wednesday 11 November 2026, 9:30am", the session page's heading. */
export function sessionTitle({ date, time }: When): string {
	return `${formatLongDate(date, { year: true })}, ${formatTime(time)}`;
}

/** "Wed 11 Nov, 9:30am", the session's breadcrumb. */
export function sessionCrumb({ date, time }: When): string {
	return `${formatShortDay(date)}, ${formatTime(time)}`;
}
