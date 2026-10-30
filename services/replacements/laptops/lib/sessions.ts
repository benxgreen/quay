import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import type { CallTrigger } from "@/lib/clients/connection-log";
import type { IsoDate } from "@/lib/dates/working-days";
import { query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import type { CaseStatus } from "@/services/replacements/laptops/lib/case-status";
import { sendCaseEmail } from "@/services/replacements/laptops/lib/emails/send";
import { addJournalEntry } from "@/services/replacements/laptops/lib/journal";
import type { SessionInput } from "@/services/replacements/laptops/lib/session-form";

/** Full is worked out from bookings and capacity; it is never stored. */
export type SessionStatus = "open" | "full" | "closed" | "cancelled";

export type SessionSummary = {
	id: string;
	type: ReplacementType;
	/** London date and time. */
	date: IsoDate;
	time: string;
	capacity: number;
	location: string;
	status: SessionStatus;
	booked: number;
};

export type SessionFilters = {
	show: "upcoming" | "past";
	/** YYYY-MM, or "" for every month. */
	month: string;
	type: ReplacementType | "";
	status: SessionStatus | "";
};

/** The reason written on each booking a session cancellation cancels. */
export const SESSION_CANCELLED_REASON = "Session cancelled by the team";

const LONDON = "'Europe/London'";

const SUMMARY_COLUMNS = `
	s.id, s.session_type AS type,
	to_char(s.starts_at AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS date,
	to_char(s.starts_at AT TIME ZONE ${LONDON}, 'HH24:MI') AS time,
	s.capacity, s.location, s.booked_count AS booked,
	CASE WHEN s.status = 'open' AND s.booked_count >= s.capacity THEN 'full' ELSE s.status END AS status`;

const STATUS_FILTER = `(
	$4 = ''
	OR ($4 = 'open' AND s.status = 'open' AND s.booked_count < s.capacity)
	OR ($4 = 'full' AND s.status = 'open' AND s.booked_count >= s.capacity)
	OR ($4 IN ('closed', 'cancelled') AND s.status = $4))`;

export function parseSessionFilters(params: Record<string, string | undefined>): SessionFilters {
	const status = params.status ?? "";
	return {
		show: params.show === "past" ? "past" : "upcoming",
		month: /^\d{4}-\d{2}$/.test(params.month ?? "") ? (params.month as string) : "",
		type: params.type === "collection" || params.type === "session" ? params.type : "",
		status: ["open", "full", "closed", "cancelled"].includes(status)
			? (status as SessionStatus)
			: "",
	};
}

/**
 * Sessions for the list: upcoming (from today, soonest first) or past
 * (latest first), with the months that have sessions for the Month filter.
 */
export async function listSessions(
	filters: SessionFilters,
	today: IsoDate,
): Promise<{ sessions: SessionSummary[]; months: string[] }> {
	const when =
		filters.show === "upcoming"
			? `s.starts_at >= ($1::date)::timestamp AT TIME ZONE ${LONDON}`
			: `s.starts_at < ($1::date)::timestamp AT TIME ZONE ${LONDON}`;
	const order = filters.show === "upcoming" ? "ASC" : "DESC";

	const [sessions, months] = await Promise.all([
		query<SessionSummary>(
			`SELECT ${SUMMARY_COLUMNS}
			 FROM lr.sessions s
			 WHERE ${when}
			   AND ($2 = '' OR to_char(s.starts_at AT TIME ZONE ${LONDON}, 'YYYY-MM') = $2)
			   AND ($3 = '' OR s.session_type = $3)
			   AND ${STATUS_FILTER}
			 ORDER BY s.starts_at ${order}, s.id`,
			[today, filters.month, filters.type, filters.status],
		),
		query<{ month: string }>(
			`SELECT DISTINCT to_char(s.starts_at AT TIME ZONE ${LONDON}, 'YYYY-MM') AS month
			 FROM lr.sessions s WHERE ${when}
			 ORDER BY month ${order}`,
			[today],
		),
	]);
	return { sessions, months: months.map((row) => row.month) };
}

export type Attendee = {
	caseId: string;
	reference: string;
	name: string;
	boxNumber: string | null;
	software: string[];
	devicePrepared: boolean;
	softwarePrepared: boolean;
};

export type CancelledAttendee = {
	caseId: string;
	reference: string;
	name: string;
	emailSentAt: Date | null;
	emailFailed: boolean;
	caseStatus: CaseStatus;
	/** Where they are booked now, if they have rebooked. */
	rebookedOnto: { date: IsoDate; time: string } | null;
};

export type SessionDetail = SessionSummary & {
	startsAt: Date;
	cancelled: { at: Date; by: string | null; reason: string | null } | null;
	attendees: Attendee[];
	cancelledAttendees: CancelledAttendee[];
};

export async function getSession(id: string): Promise<SessionDetail | null> {
	if (!/^\d+$/.test(id)) return null;
	const session = await queryOne<
		SessionSummary & {
			starts_at: Date;
			cancelled_at: Date | null;
			cancelled_by: string | null;
			cancelled_reason: string | null;
		}
	>(
		`SELECT ${SUMMARY_COLUMNS}, s.starts_at, s.cancelled_at, s.cancelled_reason,
		        cb.display_name AS cancelled_by
		 FROM lr.sessions s LEFT JOIN portal.users cb ON cb.id = s.cancelled_by
		 WHERE s.id = $1`,
		[id],
	);
	if (!session) return null;

	const { starts_at, cancelled_at, cancelled_by, cancelled_reason, ...summary } = session;
	const cancelled = cancelled_at
		? { at: cancelled_at, by: cancelled_by, reason: cancelled_reason }
		: null;

	if (cancelled) {
		const people = await query<{
			case_id: string;
			reference: string;
			name: string;
			email_sent_at: Date | null;
			email_outcome: string | null;
			case_status: CaseStatus;
			rebooked_date: IsoDate | null;
			rebooked_time: string | null;
		}>(
			`SELECT c.id AS case_id, c.reference, u.display_name AS name, c.status AS case_status,
			        e.sent_at AS email_sent_at, e.outcome AS email_outcome,
			        to_char(ns.starts_at AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS rebooked_date,
			        to_char(ns.starts_at AT TIME ZONE ${LONDON}, 'HH24:MI') AS rebooked_time
			 FROM lr.bookings b
			 JOIN lr.cases c ON c.id = b.case_id
			 JOIN portal.users u ON u.id = c.user_id
			 LEFT JOIN LATERAL (
			   SELECT sent_at, outcome FROM lr.email_sends
			   WHERE case_id = c.id AND email_key = 'session_cancelled' AND sent_at >= $2
			   ORDER BY sent_at DESC LIMIT 1
			 ) e ON true
			 LEFT JOIN lr.bookings nb ON nb.case_id = c.id AND nb.status = 'booked'
			 LEFT JOIN lr.sessions ns ON ns.id = nb.session_id
			 WHERE b.session_id = $1 AND b.status = 'cancelled' AND b.reason = $3
			 ORDER BY u.display_name`,
			[id, cancelled_at, SESSION_CANCELLED_REASON],
		);
		return {
			...summary,
			startsAt: starts_at,
			cancelled,
			attendees: [],
			cancelledAttendees: people.map((row) => ({
				caseId: row.case_id,
				reference: row.reference,
				name: row.name,
				emailSentAt: row.email_sent_at,
				emailFailed: row.email_outcome === "failed",
				caseStatus: row.case_status,
				rebookedOnto:
					row.rebooked_date && row.rebooked_time
						? { date: row.rebooked_date, time: row.rebooked_time }
						: null,
			})),
		};
	}

	const attendees = await query<{
		case_id: string;
		reference: string;
		name: string;
		box_number: string | null;
		software: string[];
		device_prepared: boolean;
		software_prepared: boolean;
	}>(
		`SELECT c.id AS case_id, c.reference, u.display_name AS name, c.box_number,
		        b.software_requested AS software,
		        c.device_prepared_at IS NOT NULL AS device_prepared,
		        c.software_prepared_at IS NOT NULL AS software_prepared
		 FROM lr.bookings b
		 JOIN lr.cases c ON c.id = b.case_id
		 JOIN portal.users u ON u.id = c.user_id
		 WHERE b.session_id = $1 AND b.status = 'booked'
		 ORDER BY u.display_name`,
		[id],
	);

	return {
		...summary,
		startsAt: starts_at,
		cancelled: null,
		cancelledAttendees: [],
		attendees: attendees.map((row) => ({
			caseId: row.case_id,
			reference: row.reference,
			name: row.name,
			boxNumber: row.box_number,
			software: [...row.software].sort((a, b) => a.localeCompare(b)),
			devicePrepared: row.device_prepared,
			softwarePrepared: row.software_prepared,
		})),
	};
}

/** Start time, capacity and location for each type (Settings › Session defaults). */
export async function getSessionDefaults(): Promise<
	Record<ReplacementType, { time: string; capacity: number; location: string }>
> {
	const rows = await query<{
		session_type: ReplacementType;
		time: string;
		capacity: number;
		location: string;
	}>(
		`SELECT session_type, to_char(start_time, 'HH24:MI') AS time, capacity, location
		 FROM lr.session_defaults`,
	);
	return Object.fromEntries(
		rows.map((row) => [
			row.session_type,
			{ time: row.time, capacity: row.capacity, location: row.location },
		]),
	) as Record<ReplacementType, { time: string; capacity: number; location: string }>;
}

const STARTS_AT = `(($2::date + $3::time) AT TIME ZONE ${LONDON})`;

export async function createSession(input: SessionInput, actorId: string): Promise<string> {
	const row = await queryOne<{ id: string }>(
		`INSERT INTO lr.sessions (session_type, starts_at, capacity, location, created_by)
		 VALUES ($1, ${STARTS_AT}, $4, $5, $6)
		 RETURNING id`,
		[input.type, input.date, input.time, input.capacity, input.location, actorId],
	);
	if (!row) throw new Error("Could not add the session");
	return row.id;
}

/**
 * Saves an edited session. The form has already checked capacity against
 * bookings; the database's sessions_not_overbooked check is the backstop
 * if someone books in between.
 */
export async function updateSession(
	id: string,
	input: SessionInput,
	actorId: string,
): Promise<void> {
	await withTransaction(
		async (tx) => {
			await query(
				`UPDATE lr.sessions
				 SET session_type = $1, starts_at = ${STARTS_AT}, capacity = $4, location = $5
				 WHERE id = $6 AND status <> 'cancelled'`,
				[input.type, input.date, input.time, input.capacity, input.location, id],
				tx,
			);
		},
		{ actingUserId: actorId },
	);
}

export type CancelSessionResult = {
	cancelled: number;
	/** People whose "Session cancelled" email did not send. */
	notEmailed: { name: string; reference: string; caseId: string }[];
};

/**
 * Cancels a session (spec, "Session cancelled by the team"). In one
 * transaction: every Booked booking on it is Cancelled, each case moves to
 * Rebook required with its booking reminders restarting from zero (the
 * cancellation wasn't the person's fault), the session is marked Cancelled
 * with the reason, and each case's journal records it. Devices and software
 * choices stay on the cases. Then each person is sent the "Session
 * cancelled" email; one that fails is journaled with a Failed tag and
 * listed so the team can follow up, and the cancellation stands.
 */
export async function cancelSession(
	id: string,
	reason: string,
	actorId: string,
): Promise<CancelSessionResult | null> {
	const affected = await withTransaction(
		async (tx) => {
			const session = await queryOne<{ status: string }>(
				"SELECT status FROM lr.sessions WHERE id = $1 FOR UPDATE",
				[id],
				tx,
			);
			if (!session || session.status === "cancelled") return null;

			const bookings = await query<{
				booking_id: string;
				case_id: string;
				reference: string;
				name: string;
			}>(
				`UPDATE lr.bookings b SET status = 'cancelled', reason = $2
				 FROM lr.cases c JOIN portal.users u ON u.id = c.user_id
				 WHERE b.session_id = $1 AND b.status = 'booked' AND c.id = b.case_id
				 RETURNING b.id AS booking_id, c.id AS case_id, c.reference, u.display_name AS name`,
				[id, SESSION_CANCELLED_REASON],
				tx,
			);

			await query(
				`UPDATE lr.cases
				 SET status = 'rebook_required', rebook_requested_at = now(),
				     reminders_sent = 0, reminders_paused = false
				 WHERE id = ANY($1::bigint[])`,
				[bookings.map((booking) => booking.case_id)],
				tx,
			);

			await query(
				`UPDATE lr.sessions
				 SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2, cancelled_reason = $3
				 WHERE id = $1`,
				[id, actorId, reason || null],
				tx,
			);

			for (const booking of bookings) {
				await addJournalEntry(tx, {
					caseId: booking.case_id,
					actor: { userId: actorId },
					kind: "booking",
					body: reason ? `Session cancelled: ${reason}` : "Session cancelled",
					data: { session_id: Number(id), booking_id: Number(booking.booking_id) },
				});
			}
			return bookings;
		},
		{ actingUserId: actorId },
	);
	if (!affected) return null;

	const trigger: CallTrigger = {
		kind: "user",
		label: "Session cancelled email",
		actorUserId: actorId,
	};
	const notEmailed: CancelSessionResult["notEmailed"] = [];
	for (const booking of affected) {
		const sent = await sendCaseEmail({
			key: "session_cancelled",
			caseId: booking.case_id,
			bookingId: booking.booking_id,
			trigger,
			actor: { userId: actorId },
		});
		if (!sent.ok) {
			notEmailed.push({
				name: booking.name,
				reference: booking.reference,
				caseId: booking.case_id,
			});
		}
	}

	return { cancelled: affected.length, notEmailed };
}
