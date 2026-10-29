/**
 * Working days: Monday to Friday, excluding England and Wales bank holidays.
 * Every date is an ISO "YYYY-MM-DD" string, never a Date, so nothing shifts
 * with time zones. These mirror lr.add_working_days, lr.next_working_day and
 * lr.is_weekly_send_day in the database, so the app and SQL agree.
 *
 * Bank holidays come from the GOV.UK feed (lib/clients/bank-holidays); pass
 * them in as a list of ISO dates.
 */

export type IsoDate = string;
export type BankHolidays = ReadonlySet<IsoDate> | readonly IsoDate[];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Throws unless `value` is a real calendar date in YYYY-MM-DD form. */
export function assertIsoDate(value: string): IsoDate {
	if (!ISO_DATE.test(value) || toUtc(value).toISOString().slice(0, 10) !== value) {
		throw new Error(`Not a date in YYYY-MM-DD form: ${value}`);
	}
	return value;
}

function toUtc(day: IsoDate): Date {
	return new Date(`${day}T00:00:00Z`);
}

function asSet(holidays: BankHolidays): ReadonlySet<IsoDate> {
	return holidays instanceof Set ? holidays : new Set(holidays);
}

/** ISO day of the week: 1 = Monday … 7 = Sunday. */
export function isoWeekday(day: IsoDate): number {
	return ((toUtc(day).getUTCDay() + 6) % 7) + 1;
}

/** The date `n` calendar days after `day` (before, if negative). */
export function addDays(day: IsoDate, n: number): IsoDate {
	const date = toUtc(day);
	date.setUTCDate(date.getUTCDate() + n);
	return date.toISOString().slice(0, 10);
}

export function isWorkingDay(day: IsoDate, holidays: BankHolidays): boolean {
	return isoWeekday(day) <= 5 && !asSet(holidays).has(day);
}

/** The date `n` working days after `day`. `n` = 0 returns `day`. */
export function addWorkingDays(day: IsoDate, n: number, holidays: BankHolidays): IsoDate {
	const set = asSet(holidays);
	let current = day;
	for (let remaining = n; remaining > 0; ) {
		current = addDays(current, 1);
		if (isWorkingDay(current, set)) {
			remaining -= 1;
		}
	}
	return current;
}

/** The date `n` working days before `day`. `n` = 0 returns `day`. */
export function subtractWorkingDays(day: IsoDate, n: number, holidays: BankHolidays): IsoDate {
	const set = asSet(holidays);
	let current = day;
	for (let remaining = n; remaining > 0; ) {
		current = addDays(current, -1);
		if (isWorkingDay(current, set)) {
			remaining -= 1;
		}
	}
	return current;
}

/** `day` if it is a working day, otherwise the next working day. */
export function nextWorkingDay(day: IsoDate, holidays: BankHolidays): IsoDate {
	return isWorkingDay(day, holidays) ? day : addWorkingDays(day, 1, holidays);
}

/**
 * Whether weekly emails due on `weekday` (1 = Monday … 5 = Friday) go out on
 * `day`: they go on that weekday, or the next working day when it is a bank
 * holiday.
 */
export function isWeeklySendDay(day: IsoDate, weekday: number, holidays: BankHolidays): boolean {
	const latestDue = addDays(day, -((isoWeekday(day) - weekday + 7) % 7));
	return nextWorkingDay(latestDue, holidays) === day;
}

/**
 * The day requested software locks for a session: from 00:00 on the
 * `lockWorkingDays`-th working day before it. For a session on Thursday
 * 12 November 2026 with a 3-day lock, that is Monday 9 November.
 */
export function softwareLockDate(
	sessionDate: IsoDate,
	lockWorkingDays: number,
	holidays: BankHolidays,
): IsoDate {
	return subtractWorkingDays(sessionDate, lockWorkingDays, holidays);
}

export function isSoftwareLocked(
	sessionDate: IsoDate,
	lockWorkingDays: number,
	today: IsoDate,
	holidays: BankHolidays,
): boolean {
	return today >= softwareLockDate(sessionDate, lockWorkingDays, holidays);
}

/**
 * Whether a colleague can book a session themselves: only sessions more than
 * `leadWorkingDays` working days away. With a 5-day lead time on Monday
 * 2 November, Monday 9 November (5 working days away) is hidden and Tuesday
 * 10 November is offered. The team can book inside the lead time.
 */
export function isBookableByColleague(
	sessionDate: IsoDate,
	leadWorkingDays: number,
	today: IsoDate,
	holidays: BankHolidays,
): boolean {
	return sessionDate > addWorkingDays(today, leadWorkingDays, holidays);
}
