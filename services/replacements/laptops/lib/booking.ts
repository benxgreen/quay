import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { getBankHolidaysClient } from "@/lib/clients/bank-holidays";
import { londonToday } from "@/lib/clock";
import { formatShortDay, formatTime } from "@/lib/dates/format";
import {
	addDays,
	type IsoDate,
	isBookableByColleague,
	isoWeekday,
	softwareLockDate,
} from "@/lib/dates/working-days";
import { describeConstraintError } from "@/lib/db/errors";
import { type Queryable, query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import { sendCaseEmail } from "@/services/replacements/laptops/lib/emails/send";
import { addJournalEntry } from "@/services/replacements/laptops/lib/journal";

/**
 * Booking (spec, "User journey" and "Book on behalf"): the dates offered,
 * booking, rebooking, software, "not available", availability requests and
 * custom appointments. Capacity is enforced by the database (the
 * sessions_not_overbooked check), so a session that fills while someone is
 * choosing fails cleanly at the moment of booking.
 *
 * The booking is saved first and the confirmation email sent after it: an
 * email can't go out for a place that turns out to be full. A failed email
 * is journaled with a Failed tag and the booking stands.
 */

const LONDON = "'Europe/London'";

export type SoftwareOption = { name: string; hint: string | null };

/** The software list, always alphabetical. */
export async function softwareList(): Promise<SoftwareOption[]> {
	return query<SoftwareOption>(
		"SELECT name, hint FROM lr.software WHERE active ORDER BY lower(name)",
	);
}

/** Splits requested software into names on the list and "Other software". */
export function splitSoftware(requested: readonly string[], list: SoftwareOption[]) {
	const known = new Set(list.map((item) => item.name.toLowerCase()));
	return {
		listed: requested.filter((name) => known.has(name.toLowerCase())),
		other: requested.filter((name) => !known.has(name.toLowerCase())),
	};
}

/** Tidies submitted software: listed names, then other names, without blanks or repeats. */
export function cleanSoftware(listed: string[], other: string[], list: SoftwareOption[]): string[] {
	const names = new Map(list.map((item) => [item.name.toLowerCase(), item.name]));
	const result: string[] = [];
	for (const name of [...listed, ...other].map((value) => value.trim()).filter(Boolean)) {
		const proper = names.get(name.toLowerCase()) ?? name.slice(0, 100);
		if (!result.some((existing) => existing.toLowerCase() === proper.toLowerCase()))
			result.push(proper);
	}
	return result;
}

export type BookingSettings = { leadDays: number; lockDays: number; holidays: IsoDate[] };

export async function bookingSettings(): Promise<BookingSettings> {
	const [row, holidays] = await Promise.all([
		queryOne<{ lead: number; lock: number }>(
			"SELECT booking_lead_working_days AS lead, software_lock_working_days AS lock FROM lr.settings WHERE id = 1",
		),
		getBankHolidaysClient()
			.englandAndWales()
			.catch(() => [] as IsoDate[]),
	]);
	return { leadDays: row?.lead ?? 5, lockDays: row?.lock ?? 3, holidays };
}

/** The last day software can be changed: the day before the lock, which starts at midnight. */
export function softwareChangeDeadline(sessionDate: IsoDate, settings: BookingSettings): IsoDate {
	return addDays(softwareLockDate(sessionDate, settings.lockDays, settings.holidays), -1);
}

export function softwareLocked(
	sessionDate: IsoDate,
	settings: BookingSettings,
	today = londonToday(),
): boolean {
	return today > softwareChangeDeadline(sessionDate, settings);
}

export type OfferedSession = {
	id: string;
	date: IsoDate;
	time: string;
	location: string;
	placesLeft: number;
};

export type OfferedWeek = { weekStarting: IsoDate; sessions: OfferedSession[] };

/**
 * Open sessions of the case's type, by week. Colleagues only see sessions
 * more than the lead time away; the team (`forTeam`) can book any future
 * session. Full sessions are listed (as Full) so a choice doesn't vanish.
 */
export async function offeredSessions(
	type: ReplacementType,
	{ forTeam = false, exclude = null }: { forTeam?: boolean; exclude?: string | null } = {},
): Promise<OfferedWeek[]> {
	const settings = await bookingSettings();
	const today = londonToday();
	const rows = await query<{
		id: string;
		date: IsoDate;
		time: string;
		location: string;
		left: number;
	}>(
		`SELECT id, to_char(starts_at AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS date,
		        to_char(starts_at AT TIME ZONE ${LONDON}, 'HH24:MI') AS time, location,
		        capacity - booked_count AS left
		 FROM lr.sessions
		 WHERE session_type = $1 AND status = 'open' AND starts_at > now()
		 ORDER BY starts_at, id`,
		[type],
	);
	const weeks: OfferedWeek[] = [];
	for (const row of rows) {
		if (row.id === exclude) continue;
		if (
			!forTeam &&
			!isBookableByColleague(row.date, settings.leadDays, today, settings.holidays)
		)
			continue;
		const weekStarting = addDays(row.date, 1 - isoWeekday(row.date));
		let week = weeks.at(-1);
		if (week?.weekStarting !== weekStarting) {
			week = { weekStarting, sessions: [] };
			weeks.push(week);
		}
		week.sessions.push({
			id: row.id,
			date: row.date,
			time: row.time,
			location: row.location,
			placesLeft: row.left,
		});
	}
	return weeks;
}

/** "Fri 13 Nov, 10:00am": a session in an error message. */
export function sessionLabel(session: { date: IsoDate; time: string }): string {
	return `${formatShortDay(session.date)}, ${formatTime(session.time)}`;
}

export type Booker = { userId: string; onBehalf: boolean };

export type BookResult = { ok: true } | { ok: false; reason: "full" | "not_allowed" };

const WAITING = ["queued", "pending", "unbooked", "rebook_required"];

async function sessionFor(tx: Queryable, sessionId: string) {
	return queryOne<{ date: IsoDate; time: string; type: ReplacementType }>(
		`SELECT to_char(starts_at AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS date,
		        to_char(starts_at AT TIME ZONE ${LONDON}, 'HH24:MI') AS time, session_type AS type
		 FROM lr.sessions WHERE id = $1 AND starts_at > now()`,
		[sessionId],
		tx,
	);
}

/**
 * The case is now Booked: reminders stop, an open availability request is
 * resolved and the "Unavailable for sessions" flag (if any) goes.
 */
async function markBooked(
	tx: Queryable,
	caseId: string,
	resolution: "session_booking" | "custom_booking",
	actorId: string,
) {
	await query(
		`UPDATE lr.cases
		 SET status = 'booked', reminders_paused = false,
		     invited_at = coalesce(invited_at, now()),
		     flag_kind = CASE WHEN flag_kind = 'unavailable' THEN NULL ELSE flag_kind END,
		     flag_reason = CASE WHEN flag_kind = 'unavailable' THEN NULL ELSE flag_reason END,
		     flagged_by = CASE WHEN flag_kind = 'unavailable' THEN NULL ELSE flagged_by END,
		     flagged_at = CASE WHEN flag_kind = 'unavailable' THEN NULL ELSE flagged_at END
		 WHERE id = $1`,
		[caseId],
		tx,
	);
	await query(
		`UPDATE lr.availability_requests SET resolved_at = now(), resolved_by = $2, resolution = $3
		 WHERE case_id = $1 AND resolved_at IS NULL`,
		[caseId, actorId, resolution],
		tx,
	);
}

async function confirmation(caseId: string, booker: Booker, label: string) {
	await sendCaseEmail({
		key: "booking_confirmed",
		caseId,
		trigger: { kind: "user", label, actorUserId: booker.userId },
		actor: { userId: booker.userId },
	});
}

function bookingProblem(error: unknown): BookResult | null {
	// Full, closed or cancelled while they were choosing: ask for another date.
	return describeConstraintError(error)?.problem === "session_unavailable"
		? { ok: false, reason: "full" }
		: null;
}

/**
 * Books a published session for a case waiting for a booking. The team
 * (`onBehalf`) can book inside the lead time and choose not to email.
 */
export async function bookSession(
	caseId: string,
	sessionId: string,
	software: string[],
	booker: Booker,
	{ email = true }: { email?: boolean } = {},
): Promise<BookResult> {
	let saved: boolean;
	try {
		saved = await withTransaction(
			async (tx) => {
				const target = await queryOne<{ status: string; type: ReplacementType }>(
					"SELECT status, session_type AS type FROM lr.cases WHERE id = $1 FOR UPDATE",
					[caseId],
					tx,
				);
				if (!target || !WAITING.includes(target.status)) return false;
				const session = await sessionFor(tx, sessionId);
				if (!session) return false;
				await query(
					`INSERT INTO lr.bookings (case_id, session_id, software_requested, software_changed_at, booked_by)
					 VALUES ($1, $2, $3, now(), $4)`,
					[caseId, sessionId, software, booker.onBehalf ? booker.userId : null],
					tx,
				);
				await markBooked(tx, caseId, "session_booking", booker.userId);
				await addJournalEntry(tx, {
					caseId,
					actor: { userId: booker.userId },
					kind: "booking",
					body: `Booked ${target.type === "collection" ? "Collection" : "Session"} on ${sessionLabel(session)}${booker.onBehalf ? " on their behalf" : ""}. Software requested: ${software.length ? software.join(", ") : "none"}`,
				});
				return true;
			},
			{ actingUserId: booker.userId },
		);
	} catch (error) {
		const problem = bookingProblem(error);
		if (problem) return problem;
		throw error;
	}
	if (!saved) return { ok: false, reason: "not_allowed" };
	if (email)
		await confirmation(
			caseId,
			booker,
			booker.onBehalf ? "Book on behalf" : "Booking confirmed",
		);
	return { ok: true };
}

/**
 * Rebook onto another session of the same type, until the current booking
 * starts. The old booking is marked Rebooked and the software carried over.
 */
export async function rebook(
	caseId: string,
	sessionId: string,
	booker: Booker,
): Promise<BookResult> {
	let saved: boolean;
	try {
		saved = await withTransaction(
			async (tx) => {
				const current = await currentBooking(tx, caseId, true);
				if (!current) return false;
				const session = await sessionFor(tx, sessionId);
				if (!session) return false;
				await query(
					"UPDATE lr.bookings SET status = 'rebooked' WHERE id = $1",
					[current.id],
					tx,
				);
				await query(
					`INSERT INTO lr.bookings
					   (case_id, session_id, software_requested, software_changed_at, booked_by, replaces_booking_id)
					 VALUES ($1, $2, $3, $4, $5, $6)`,
					[
						caseId,
						sessionId,
						current.software,
						current.software_changed_at,
						booker.onBehalf ? booker.userId : null,
						current.id,
					],
					tx,
				);
				await addJournalEntry(tx, {
					caseId,
					actor: { userId: booker.userId },
					kind: "booking",
					body: `Session date changed from ${sessionLabel(current)} to ${sessionLabel(session)}${booker.onBehalf ? " on their behalf" : ""}`,
				});
				return true;
			},
			{ actingUserId: booker.userId },
		);
	} catch (error) {
		const problem = bookingProblem(error);
		if (problem) return problem;
		throw error;
	}
	if (!saved) return { ok: false, reason: "not_allowed" };
	await confirmation(caseId, booker, "Rebooked");
	return { ok: true };
}

type CurrentBooking = {
	id: string;
	software: string[];
	software_changed_at: Date | null;
	date: IsoDate;
	time: string;
};

async function currentBooking(
	tx: Queryable,
	caseId: string,
	lock: boolean,
): Promise<CurrentBooking | undefined> {
	return queryOne<CurrentBooking>(
		`SELECT b.id, b.software_requested AS software, b.software_changed_at,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS date,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'HH24:MI') AS time
		 FROM lr.bookings b LEFT JOIN lr.sessions s ON s.id = b.session_id
		 WHERE b.case_id = $1 AND b.status = 'booked'
		   AND coalesce(s.starts_at, b.custom_starts_at) > now()
		 ${lock ? "FOR UPDATE OF b" : ""}`,
		[caseId],
		tx,
	);
}

/**
 * Change software on the current booking. Colleagues can until the lock;
 * the team can until the replacement is completed, recorded as an override
 * once the lock has passed.
 */
export async function changeSoftware(
	caseId: string,
	software: string[],
	booker: Booker,
): Promise<{ ok: true } | { ok: false; reason: "locked" | "not_allowed" }> {
	const settings = await bookingSettings();
	return withTransaction(
		async (tx) => {
			const current = await currentBooking(tx, caseId, true);
			if (!current) return { ok: false as const, reason: "not_allowed" as const };
			const locked = softwareLocked(current.date, settings);
			if (locked && !booker.onBehalf)
				return { ok: false as const, reason: "locked" as const };
			await query(
				"UPDATE lr.bookings SET software_requested = $2, software_changed_at = now() WHERE id = $1",
				[current.id, software],
				tx,
			);
			await addJournalEntry(tx, {
				caseId,
				actor: { userId: booker.userId },
				kind: "software",
				body: `${locked ? "Software changed by the team after the lock (override)" : "Software changed"}: ${software.length ? software.join(", ") : "none"} (was ${current.software.length ? current.software.join(", ") : "none"})`,
				data: { before: current.software, after: software, override: locked },
			});
			return { ok: true as const };
		},
		{ actingUserId: booker.userId },
	);
}

/**
 * "I am not available for any of these dates" on the rebook page: the
 * booking is cancelled and the case moves to Unbooked with reminders
 * paused (CLAUDE.md decision). Software choices are kept on the cancelled
 * booking for when they book again.
 */
export async function notAvailable(caseId: string, userId: string): Promise<boolean> {
	return withTransaction(
		async (tx) => {
			const current = await currentBooking(tx, caseId, true);
			if (!current) return false;
			await query(
				"UPDATE lr.bookings SET status = 'cancelled', reason = 'Not available for any of the dates' WHERE id = $1",
				[current.id],
				tx,
			);
			await query(
				"UPDATE lr.cases SET status = 'unbooked', reminders_paused = true WHERE id = $1",
				[caseId],
				tx,
			);
			await addJournalEntry(tx, {
				caseId,
				actor: { userId },
				kind: "booking",
				body: `Booking on ${sessionLabel(current)} cancelled: not available for any of the dates offered`,
			});
			return true;
		},
		{ actingUserId: userId },
	);
}

export const AVAILABILITY_REASONS = {
	non_standard_hours: "I work non-standard days or hours",
	away_for_all_dates: "I am away for all of the dates offered",
	other: "Something else",
} as const;

export type AvailabilityReason = keyof typeof AVAILABILITY_REASONS;

/**
 * "Tell us when you are available": the case moves to Unbooked, flagged
 * "Unavailable for sessions", with reminders paused; any booking is
 * cancelled; the request (with their software) goes in the journal; and
 * the "Availability request received" email is sent.
 */
export async function requestAvailability(
	caseId: string,
	{
		reason,
		availability,
		software,
	}: { reason: AvailabilityReason; availability: string; software: string[] },
	userId: string,
): Promise<boolean> {
	const saved = await withTransaction(
		async (tx) => {
			const target = await queryOne<{ status: string }>(
				"SELECT status FROM lr.cases WHERE id = $1 FOR UPDATE",
				[caseId],
				tx,
			);
			if (
				!target ||
				!["pending", "unbooked", "rebook_required", "booked"].includes(target.status)
			)
				return false;
			await query(
				"UPDATE lr.bookings SET status = 'cancelled', reason = 'Asked for another time' WHERE case_id = $1 AND status = 'booked'",
				[caseId],
				tx,
			);
			await query(
				`UPDATE lr.availability_requests SET resolved_at = now(), resolved_by = $2, resolution = 'reinvited'
				 WHERE case_id = $1 AND resolved_at IS NULL`,
				[caseId, userId],
				tx,
			);
			await query(
				`INSERT INTO lr.availability_requests (case_id, reason, availability, software_requested)
				 VALUES ($1, $2, $3, $4)`,
				[caseId, reason, availability, software],
				tx,
			);
			await query(
				`UPDATE lr.cases
				 SET status = 'unbooked', reminders_paused = true, flag_kind = 'unavailable',
				     flag_reason = 'Unavailable for sessions', flagged_by = NULL, flagged_at = now()
				 WHERE id = $1`,
				[caseId],
				tx,
			);
			await addJournalEntry(tx, {
				caseId,
				actor: { userId },
				kind: "availability",
				body: `Availability request: ${AVAILABILITY_REASONS[reason]}. ${availability} Software: ${software.length ? software.join(", ") : "none"}`,
				data: { reason, availability, software },
			});
			return true;
		},
		{ actingUserId: userId },
	);
	if (saved) {
		await sendCaseEmail({
			key: "availability_received",
			caseId,
			trigger: { kind: "user", label: "Availability request", actorUserId: userId },
			actor: { userId },
		});
	}
	return saved;
}

export type OpenAvailability = {
	reason: AvailabilityReason;
	availability: string;
	software: string[];
	submittedAt: Date;
};

export async function openAvailabilityRequest(caseId: string): Promise<OpenAvailability | null> {
	const row = await queryOne<{
		reason: AvailabilityReason;
		availability: string;
		software: string[];
		submitted_at: Date;
	}>(
		`SELECT reason, availability, software_requested AS software, submitted_at
		 FROM lr.availability_requests WHERE case_id = $1 AND resolved_at IS NULL`,
		[caseId],
	);
	return row
		? {
				reason: row.reason,
				availability: row.availability,
				software: row.software,
				submittedAt: row.submitted_at,
			}
		: null;
}

/**
 * Book a custom appointment (team only, once the person has said they can't
 * attend any date): a date, time and location agreed with them, not tied to
 * a session and using no place. Their software comes from their request.
 */
export async function bookCustomAppointment(
	caseId: string,
	{ date, time, location, note }: { date: IsoDate; time: string; location: string; note: string },
	userId: string,
): Promise<boolean> {
	const saved = await withTransaction(
		async (tx) => {
			const target = await queryOne<{ status: string }>(
				"SELECT status FROM lr.cases WHERE id = $1 FOR UPDATE",
				[caseId],
				tx,
			);
			if (target?.status !== "unbooked") return false;
			const request = await queryOne<{ software: string[] }>(
				"SELECT software_requested AS software FROM lr.availability_requests WHERE case_id = $1 AND resolved_at IS NULL",
				[caseId],
				tx,
			);
			const previous = await queryOne<{ software: string[] }>(
				"SELECT software_requested AS software FROM lr.bookings WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1",
				[caseId],
				tx,
			);
			const software = request?.software ?? previous?.software ?? [];
			await query(
				`INSERT INTO lr.bookings
				   (case_id, custom_starts_at, custom_location, custom_note, software_requested, software_changed_at, booked_by)
				 VALUES ($1, ($2::date + $3::time) AT TIME ZONE ${LONDON}, $4, $5, $6, now(), $7)`,
				[caseId, date, time, location, note || null, software, userId],
				tx,
			);
			await markBooked(tx, caseId, "custom_booking", userId);
			await addJournalEntry(tx, {
				caseId,
				actor: { userId },
				kind: "booking",
				body: `Custom appointment booked: ${sessionLabel({ date, time })}, ${location}. Software: ${software.length ? software.join(", ") : "none"}`,
			});
			return true;
		},
		{ actingUserId: userId },
	);
	if (saved) await confirmation(caseId, { userId, onBehalf: true }, "Custom appointment");
	return saved;
}
