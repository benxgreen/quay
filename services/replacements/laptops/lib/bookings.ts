import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { addDays, assertIsoDate, type IsoDate, isoWeekday } from "@/lib/dates/working-days";
import { query } from "@/lib/db/query";
import type { SessionStatus } from "@/services/replacements/laptops/lib/sessions";

/**
 * The Bookings dashboard (spec, "Bookings dashboard"): the engineers' view
 * of who is coming in, by day, week or month, or every upcoming booking.
 */

export type BookingsView = "day" | "week" | "month" | "all" | "incomplete";

export type BookingsFilters = {
	view: BookingsView;
	/** The day shown, or a day in the week or month shown. */
	date: IsoDate;
	q: string;
	type: ReplacementType | "";
	/** Published sessions or custom appointments. */
	kind: "" | "published" | "custom";
	deviceUnprepared: boolean;
	softwareUnprepared: boolean;
	/** All bookings only: include bookings from past days. */
	past: boolean;
};

export function parseBookingsFilters(
	params: Record<string, string | undefined>,
	today: IsoDate,
): BookingsFilters {
	const view = params.view ?? "";
	let date = today;
	try {
		if (params.date) date = assertIsoDate(params.date);
	} catch {
		// A broken date falls back to today.
	}
	return {
		view: ["week", "month", "all", "incomplete"].includes(view)
			? (view as BookingsView)
			: "day",
		date,
		q: (params.q ?? "").trim(),
		type: params.type === "collection" || params.type === "session" ? params.type : "",
		kind: params.kind === "published" || params.kind === "custom" ? params.kind : "",
		deviceUnprepared: params.device === "1",
		softwareUnprepared: params.software === "1",
		past: params.past === "1",
	};
}

/** True when a filter narrows down the people, not just the sessions. */
export function filtersPeople(filters: BookingsFilters): boolean {
	return Boolean(filters.q || filters.deviceUnprepared || filters.softwareUnprepared);
}

export type DashboardBooking = {
	bookingId: string;
	caseId: string;
	reference: string;
	name: string;
	type: ReplacementType;
	/** Null for a custom appointment. */
	sessionId: string | null;
	date: IsoDate;
	time: string;
	location: string;
	boxNumber: string | null;
	software: string[];
	devicePrepared: boolean;
	softwarePrepared: boolean;
	flagReason: string | null;
};

export type DashboardSession = {
	id: string;
	type: ReplacementType;
	date: IsoDate;
	time: string;
	location: string;
	capacity: number;
	booked: number;
	status: SessionStatus;
};

const LONDON = "'Europe/London'";
const STARTS = "coalesce(se.starts_at, b.custom_starts_at)";

type BookingRow = {
	booking_id: string;
	case_id: string;
	reference: string;
	name: string;
	type: ReplacementType;
	session_id: string | null;
	date: string;
	time: string;
	location: string;
	box_number: string | null;
	software: string[];
	device_prepared: boolean;
	software_prepared: boolean;
	flag_reason: string | null;
};

/**
 * Booked bookings between two London dates (inclusive; `to` null for no
 * end), earliest first, narrowed by type and kind. `statuses` adds attended
 * bookings for "Include past bookings".
 */
async function bookingsBetween(
	from: IsoDate | null,
	to: IsoDate | null,
	filters: BookingsFilters,
	statuses: readonly string[] = ["booked"],
): Promise<DashboardBooking[]> {
	const rows = await query<BookingRow>(
		`SELECT b.id AS booking_id, c.id AS case_id, c.reference, u.display_name AS name,
		        c.session_type AS type, b.session_id,
		        to_char(${STARTS} AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS date,
		        to_char(${STARTS} AT TIME ZONE ${LONDON}, 'HH24:MI') AS time,
		        coalesce(se.location, b.custom_location) AS location,
		        c.box_number, b.software_requested AS software,
		        c.device_prepared_at IS NOT NULL AS device_prepared,
		        c.software_prepared_at IS NOT NULL AS software_prepared,
		        c.flag_reason
		 FROM lr.bookings b
		 JOIN lr.cases c ON c.id = b.case_id
		 JOIN portal.users u ON u.id = c.user_id
		 LEFT JOIN lr.sessions se ON se.id = b.session_id
		 WHERE b.status = ANY ($1)
		   AND ($2::date IS NULL OR (${STARTS} AT TIME ZONE ${LONDON})::date >= $2::date)
		   AND ($3::date IS NULL OR (${STARTS} AT TIME ZONE ${LONDON})::date <= $3::date)
		   AND ($4 = '' OR c.session_type = $4)
		   AND ($5 = '' OR ($5 = 'custom') = (b.session_id IS NULL))
		 ORDER BY ${STARTS}, u.display_name, b.id`,
		[statuses, from, to, filters.type, filters.kind],
	);
	return rows.map((row) => ({
		bookingId: row.booking_id,
		caseId: row.case_id,
		reference: row.reference,
		name: row.name,
		type: row.type,
		sessionId: row.session_id,
		date: row.date,
		time: row.time,
		location: row.location,
		boxNumber: row.box_number,
		software: [...row.software].sort((a, b) => a.localeCompare(b)),
		devicePrepared: row.device_prepared,
		softwarePrepared: row.software_prepared,
		flagReason: row.flag_reason,
	}));
}

/** Whether a booking matches the search and the "not prepared" filters. */
function matchesPeople(booking: DashboardBooking, filters: BookingsFilters): boolean {
	if (filters.deviceUnprepared && booking.devicePrepared) return false;
	if (filters.softwareUnprepared && (!booking.software.length || booking.softwarePrepared)) {
		return false;
	}
	if (!filters.q) return true;
	const q = filters.q.toLowerCase();
	return [booking.name, booking.reference, ...booking.software].some((text) =>
		text.toLowerCase().includes(q),
	);
}

/** Published sessions between two London dates, cancelled ones included. */
async function sessionsBetween(
	from: IsoDate,
	to: IsoDate,
	filters: BookingsFilters,
): Promise<DashboardSession[]> {
	if (filters.kind === "custom") return [];
	return query<DashboardSession>(
		`SELECT s.id, s.session_type AS type,
		        to_char(s.starts_at AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS date,
		        to_char(s.starts_at AT TIME ZONE ${LONDON}, 'HH24:MI') AS time,
		        s.location, s.capacity, s.booked_count AS booked,
		        CASE WHEN s.status = 'open' AND s.booked_count >= s.capacity THEN 'full' ELSE s.status END AS status
		 FROM lr.sessions s
		 WHERE (s.starts_at AT TIME ZONE ${LONDON})::date BETWEEN $1::date AND $2::date
		   AND ($3 = '' OR s.session_type = $3)
		 ORDER BY s.starts_at, s.id`,
		[from, to, filters.type],
	);
}

/** A published session with its bookings, or one custom appointment. */
export type DayGroup =
	| { kind: "session"; session: DashboardSession; bookings: DashboardBooking[] }
	| { kind: "custom"; booking: DashboardBooking };

function groupTime(group: DayGroup): string {
	return group.kind === "session" ? group.session.time : group.booking.time;
}

/**
 * Sessions and custom appointments in time order, each with the people
 * booked. When the search or a "not prepared" filter is on, only groups
 * with someone matching are kept, and only the matching people.
 */
async function groupsBetween(
	from: IsoDate,
	to: IsoDate,
	filters: BookingsFilters,
): Promise<{ date: IsoDate; group: DayGroup; allBookings: DashboardBooking[] }[]> {
	const [sessions, bookings] = await Promise.all([
		sessionsBetween(from, to, filters),
		bookingsBetween(from, to, filters),
	]);
	const narrowing = filtersPeople(filters);
	const groups: { date: IsoDate; group: DayGroup; allBookings: DashboardBooking[] }[] = [];
	for (const session of sessions) {
		const all = bookings.filter((booking) => booking.sessionId === session.id);
		const matching = all.filter((booking) => matchesPeople(booking, filters));
		if (narrowing && !matching.length) continue;
		groups.push({
			date: session.date,
			group: { kind: "session", session, bookings: matching },
			allBookings: all,
		});
	}
	for (const booking of bookings) {
		if (booking.sessionId || !matchesPeople(booking, filters)) continue;
		groups.push({
			date: booking.date,
			group: { kind: "custom", booking },
			allBookings: [booking],
		});
	}
	return groups.sort(
		(a, b) =>
			a.date.localeCompare(b.date) || groupTime(a.group).localeCompare(groupTime(b.group)),
	);
}

/** The Day view: each session and custom appointment that day. */
export async function dayGroups(filters: BookingsFilters): Promise<DayGroup[]> {
	const groups = await groupsBetween(filters.date, filters.date, filters);
	return groups.map(({ group }) => group);
}

export type WeekItem = DayGroup & {
	/** Everyone booked, whatever the search, for "booked" and "devices prepared". */
	booked: number;
	devicesPrepared: number;
};

export type WeekDay = { date: IsoDate; items: WeekItem[] };

/** Monday of the week holding a day. */
export function weekStart(day: IsoDate): IsoDate {
	return addDays(day, 1 - isoWeekday(day));
}

/** The Week view: Monday to Friday, each day's sessions and custom appointments. */
export async function weekDays(filters: BookingsFilters): Promise<WeekDay[]> {
	const monday = weekStart(filters.date);
	const friday = addDays(monday, 4);
	const groups = await groupsBetween(monday, friday, filters);
	return [0, 1, 2, 3, 4].map((offset) => {
		const date = addDays(monday, offset);
		return {
			date,
			items: groups
				.filter((entry) => entry.date === date)
				.map(({ group, allBookings }) => ({
					...group,
					booked: allBookings.length,
					devicesPrepared: allBookings.filter((booking) => booking.devicePrepared).length,
				})),
		};
	});
}

/** The Month view: every published session in the month, cancelled ones included. */
export async function monthSessions(filters: BookingsFilters): Promise<DashboardSession[]> {
	const first = `${filters.date.slice(0, 7)}-01`;
	const last = addDays(addMonths(first, 1), -1);
	const groups = await groupsBetween(first, last, { ...filters, kind: "published" });
	return groups.flatMap(({ group }) => (group.kind === "session" ? [group.session] : []));
}

/** The first of the month `n` months after (or before) the first of a month. */
export function addMonths(first: IsoDate, n: number): IsoDate {
	const [year, month] = first.split("-").map(Number);
	const index = year * 12 + (month - 1) + n;
	return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

/** All bookings: every upcoming booking earliest first, or every booking with past ones. */
export async function allBookings(
	filters: BookingsFilters,
	today: IsoDate,
): Promise<DashboardBooking[]> {
	const bookings = filters.past
		? await bookingsBetween(null, null, filters, ["booked", "attended"])
		: await bookingsBetween(today, null, filters);
	return bookings.filter((booking) => matchesPeople(booking, filters));
}

/**
 * Incomplete bookings: bookings from past days still marked Booked, oldest
 * first, so the replacement was neither completed nor marked did not
 * attend. The same bookings as the review modal, with the dashboard's filters.
 */
export async function incompleteBookings(
	filters: BookingsFilters,
	today: IsoDate,
): Promise<DashboardBooking[]> {
	const bookings = await bookingsBetween(null, addDays(today, -1), filters);
	return bookings.filter((booking) => matchesPeople(booking, filters));
}

export type ReviewBooking = Pick<
	DashboardBooking,
	"bookingId" | "reference" | "name" | "type" | "date" | "time" | "boxNumber"
> & { custom: boolean };

/**
 * Bookings from past days still marked Booked (spec, "Close sessions"):
 * the replacement wasn't completed and nobody recorded that the person
 * didn't attend. Shown at the top of the dashboard for the team to review.
 */
export async function bookingsToReview(today: IsoDate): Promise<ReviewBooking[]> {
	const yesterday = addDays(today, -1);
	const bookings = await bookingsBetween(null, yesterday, {
		...parseBookingsFilters({}, today),
	});
	return bookings.map((booking) => ({
		bookingId: booking.bookingId,
		reference: booking.reference,
		name: booking.name,
		type: booking.type,
		date: booking.date,
		time: booking.time,
		boxNumber: booking.boxNumber,
		custom: !booking.sessionId,
	}));
}
