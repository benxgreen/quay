import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import type { IsoDate } from "@/lib/dates/working-days";
import { query, queryOne } from "@/lib/db/query";
import { caseFromToken } from "@/services/replacements/laptops/lib/booking-link";
import type { CaseStatus } from "@/services/replacements/laptops/lib/case-status";
import { SESSION_CANCELLED_REASON } from "@/services/replacements/laptops/lib/sessions";

/**
 * A colleague's own laptop replacement (spec, "User journey" and "Access").
 * The case is always matched on the signed-in person; the signed link in
 * emails only chooses which of their cases, if they have more than one.
 * Colleagues never see the case reference.
 */

const LONDON = "'Europe/London'";

export type MyBooking = {
	sessionId: string | null;
	date: IsoDate;
	time: string;
	location: string;
	software: string[];
	note: string | null;
	startsAt: Date;
};

export type MyCase = {
	id: string;
	status: CaseStatus;
	type: ReplacementType;
	serial: string | null;
	booking: MyBooking | null;
	/** Why the last booking ended, when the case needs a new one. */
	lastCancelled: {
		reason: "session_cancelled" | "not_available" | "team" | "did_not_attend";
		date: IsoDate;
	} | null;
	person: { firstName: string; email: string; username: string | null };
};

export async function myCase(userId: string, token?: string): Promise<MyCase | null> {
	const tokenCase = caseFromToken(token);
	const row = await queryOne<{
		id: string;
		status: CaseStatus;
		type: ReplacementType;
		serial: string | null;
		name: string;
		email: string;
		username: string | null;
	}>(
		`SELECT c.id, c.status, c.session_type AS type, c.old_serial AS serial,
		        u.display_name AS name, u.email, u.username
		 FROM lr.cases c JOIN portal.users u ON u.id = c.user_id
		 WHERE c.user_id = $1 AND c.status NOT IN ('completed', 'withdrawn', 'queued')
		 ORDER BY (c.id = $2::bigint) DESC, c.created_at DESC
		 LIMIT 1`,
		[userId, tokenCase],
	);
	if (!row) return null;

	const [booking, last] = await Promise.all([
		queryOne<{
			session_id: string | null;
			date: IsoDate;
			time: string;
			location: string;
			software: string[];
			note: string | null;
			starts_at: Date;
		}>(
			`SELECT b.session_id,
			        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS date,
			        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'HH24:MI') AS time,
			        coalesce(s.location, b.custom_location) AS location, b.software_requested AS software,
			        b.custom_note AS note, coalesce(s.starts_at, b.custom_starts_at) AS starts_at
			 FROM lr.bookings b LEFT JOIN lr.sessions s ON s.id = b.session_id
			 WHERE b.case_id = $1 AND b.status = 'booked'`,
			[row.id],
		),
		queryOne<{ status: string; reason: string | null; date: IsoDate }>(
			`SELECT b.status, b.reason,
			        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS date
			 FROM lr.bookings b LEFT JOIN lr.sessions s ON s.id = b.session_id
			 WHERE b.case_id = $1 AND b.status IN ('cancelled', 'did_not_attend', 'unsuccessful')
			 ORDER BY b.updated_at DESC LIMIT 1`,
			[row.id],
		),
	]);

	const waiting = ["unbooked", "rebook_required"].includes(row.status);
	return {
		id: row.id,
		status: row.status,
		type: row.type,
		serial: row.serial,
		booking: booking
			? {
					sessionId: booking.session_id,
					date: booking.date,
					time: booking.time,
					location: booking.location,
					software: [...booking.software].sort((a, b) => a.localeCompare(b)),
					note: booking.note,
					startsAt: booking.starts_at,
				}
			: null,
		lastCancelled:
			waiting && last
				? {
						reason:
							last.reason === SESSION_CANCELLED_REASON
								? "session_cancelled"
								: last.reason === "Not available for any of the dates"
									? "not_available"
									: last.status === "cancelled"
										? "team"
										: "did_not_attend",
						date: last.date,
					}
				: null,
		person: { firstName: row.name.split(" ")[0], email: row.email, username: row.username },
	};
}

/** The software choices to start from when booking again: the last booking's. */
export async function previousSoftware(caseId: string): Promise<string[]> {
	const row = await queryOne<{ software: string[] }>(
		`SELECT software_requested AS software FROM lr.bookings WHERE case_id = $1
		 ORDER BY created_at DESC LIMIT 1`,
		[caseId],
	);
	return row?.software ?? [];
}

/** Portal content (Settings) for the type, with {username}, {date} and {location} filled. */
export async function pageContent(type: ReplacementType): Promise<string> {
	const row = await queryOne<{ body: string }>(
		"SELECT body_markdown AS body FROM lr.page_content WHERE session_type = $1",
		[type],
	);
	return row?.body ?? "";
}

export async function faqs(type: ReplacementType): Promise<{ question: string; answer: string }[]> {
	return query<{ question: string; answer: string }>(
		`SELECT question, answer_markdown AS answer FROM lr.faqs
		 WHERE active AND $1 = ANY(shown_for) ORDER BY sort_order, id`,
		[type],
	);
}
