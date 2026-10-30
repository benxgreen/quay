import {
	addWorkingDays,
	type BankHolidays,
	type IsoDate,
	isWorkingDay,
	nextWorkingDay,
} from "@/lib/dates/working-days";

/** The invitation job runs at 9am London time on working days. */
export const INVITATION_RUN_TIME = "09:00";

/**
 * The next `count` days the invitation job will run, starting today if it
 * is a working day and 9am hasn't passed.
 *
 * @param now London date and time (HH:MM)
 */
export function invitationRunDays(
	now: { day: IsoDate; time: string },
	holidays: BankHolidays,
	count: number,
): IsoDate[] {
	const ranToday = !isWorkingDay(now.day, holidays) || now.time >= INVITATION_RUN_TIME;
	const first = ranToday
		? addWorkingDays(now.day, 1, holidays)
		: nextWorkingDay(now.day, holidays);
	const days = [first];
	while (days.length < count) {
		days.push(addWorkingDays(days[days.length - 1], 1, holidays));
	}
	return days;
}

/**
 * When the case at `position` (1 = next) in the queue should be invited, at
 * `perDay` invitations each working day. Null if beyond the days given.
 */
export function estimatedInvitation(
	position: number,
	perDay: number,
	runDays: readonly IsoDate[],
): IsoDate | null {
	return runDays[Math.ceil(position / perDay) - 1] ?? null;
}
