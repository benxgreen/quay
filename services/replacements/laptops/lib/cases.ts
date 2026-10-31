import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import type { CallTrigger } from "@/lib/clients/connection-log";
import { londonToday } from "@/lib/clock";
import type { IsoDate } from "@/lib/dates/working-days";
import { type Queryable, query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import {
	BEFORE_COMPLETION,
	type BookingStatus,
	CASE_STATUSES,
	type CaseStatus,
} from "@/services/replacements/laptops/lib/case-status";
import { currentStep, stepLabel } from "@/services/replacements/laptops/lib/case-steps";
import type { LaptopEmailKey } from "@/services/replacements/laptops/lib/emails";
import {
	type SendEmailResult,
	sendCaseEmail,
} from "@/services/replacements/laptops/lib/emails/send";
import { addJournalEntry } from "@/services/replacements/laptops/lib/journal";

const LONDON = "'Europe/London'";

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

export const CASE_COLUMNS = {
	oldDevice: "Old device",
	type: "Type",
	status: "Status",
	session: "Session",
	box: "Box number",
	software: "Software requested",
	email: "Email",
	department: "Department",
	added: "Date added",
	lastReminder: "Last reminder",
} as const;

export type CaseColumn = keyof typeof CASE_COLUMNS;

export const DEFAULT_COLUMNS: CaseColumn[] = ["oldDevice", "type", "status", "session", "box"];

export const CASE_SORTS = {
	session: "Next session date",
	name: "Name",
	added: "Date added",
	status: "Status",
} as const;

export type CaseFilters = {
	search: string;
	sort: keyof typeof CASE_SORTS;
	/** A status, or "" for every open case. */
	status: CaseStatus | "";
	type: ReplacementType | "";
	flagged: boolean;
	noDevice: boolean;
	archived: boolean;
	columns: CaseColumn[];
};

type Params = Record<string, string | string[] | undefined>;

export function parseCaseFilters(params: Params): CaseFilters {
	const one = (key: string) => {
		const value = params[key];
		return (Array.isArray(value) ? value[0] : value) ?? "";
	};
	const columns = [params.columns ?? []]
		.flat()
		.filter((column): column is CaseColumn => column in CASE_COLUMNS);
	const status = one("status");
	const type = one("type");
	return {
		search: one("q").trim(),
		sort: one("sort") in CASE_SORTS ? (one("sort") as CaseFilters["sort"]) : "session",
		status: (CASE_STATUSES as readonly string[]).includes(status) ? (status as CaseStatus) : "",
		type: type === "collection" || type === "session" ? type : "",
		flagged: one("flagged") === "1",
		noDevice: one("noDevice") === "1",
		archived: one("archived") === "1",
		columns: params.columns === undefined ? DEFAULT_COLUMNS : columns,
	};
}

export type CaseRow = {
	id: string;
	reference: string;
	name: string;
	email: string;
	department: string | null;
	oldSerial: string | null;
	oldHostname: string | null;
	type: ReplacementType;
	status: CaseStatus;
	step: string | null;
	flagReason: string | null;
	session: { date: IsoDate; time: string } | null;
	boxNumber: string | null;
	software: string[] | null;
	addedAt: Date;
	lastReminderAt: Date | null;
};

/** Archived: Completed or Withdrawn more than the archive period ago (Settings). */
const ARCHIVED = `(c.closed_at IS NOT NULL AND c.closed_at < now() - (SELECT archive_after FROM lr.settings WHERE id = 1))`;

export async function listCases(filters: CaseFilters): Promise<CaseRow[]> {
	const like = `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
	const order: Record<CaseFilters["sort"], string> = {
		session: "coalesce(s.starts_at, b.custom_starts_at) ASC NULLS LAST, c.id",
		name: "lower(u.display_name), c.id",
		added: "c.created_at DESC, c.id DESC",
		status: `array_position(ARRAY[${CASE_STATUSES.map((status) => `'${status}'`).join(",")}], c.status), c.id`,
	};
	const rows = await query<{
		id: string;
		reference: string;
		name: string;
		email: string;
		department: string | null;
		old_serial: string | null;
		old_hostname: string | null;
		type: ReplacementType;
		status: CaseStatus;
		flag_reason: string | null;
		flagged: boolean;
		session_date: IsoDate | null;
		session_time: string | null;
		box_number: string | null;
		software: string[] | null;
		device_prepared_at: Date | null;
		software_prepared_at: Date | null;
		created_at: Date;
		last_reminder_at: Date | null;
	}>(
		`SELECT c.id, c.reference, u.display_name AS name, u.email, u.department,
		        c.old_serial, c.old_hostname, c.session_type AS type, c.status,
		        c.flag_reason, c.flag_kind IS NOT NULL AS flagged,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS session_date,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'HH24:MI') AS session_time,
		        c.box_number, b.software_requested AS software,
		        c.device_prepared_at, c.software_prepared_at, c.created_at, c.last_reminder_at
		 FROM lr.cases c
		 JOIN portal.users u ON u.id = c.user_id
		 LEFT JOIN lr.bookings b ON b.case_id = c.id AND b.status = 'booked'
		 LEFT JOIN lr.sessions s ON s.id = b.session_id
		 WHERE ($1 = '%%' OR u.display_name ILIKE $1 OR u.email ILIKE $1 OR c.old_serial ILIKE $1
		        OR c.old_hostname ILIKE $1 OR c.reference ILIKE $1)
		   AND ($2 = '' AND c.status NOT IN ('completed', 'withdrawn') OR c.status = $2)
		   AND ($3 = '' OR c.session_type = $3)
		   AND (NOT $4 OR c.flag_kind IS NOT NULL)
		   AND (NOT $5 OR c.box_number IS NULL)
		   AND ($6 OR NOT ${ARCHIVED})
		 ORDER BY ${order[filters.sort]}`,
		[like, filters.status, filters.type, filters.flagged, filters.noDevice, filters.archived],
	);

	return rows.map((row) => ({
		id: row.id,
		reference: row.reference,
		name: row.name,
		email: row.email,
		department: row.department,
		oldSerial: row.old_serial,
		oldHostname: row.old_hostname,
		type: row.type,
		status: row.status,
		step: stepLabel({
			status: row.status,
			boxNumber: row.box_number,
			devicePreparedAt: row.device_prepared_at,
			softwarePreparedAt: row.software_prepared_at,
			softwareRequested: row.software,
		}),
		flagReason: row.flagged ? (row.flag_reason ?? "Flagged") : null,
		session:
			row.session_date && row.session_time
				? { date: row.session_date, time: row.session_time }
				: null,
		boxNumber: row.box_number,
		software: row.software,
		addedAt: row.created_at,
		lastReminderAt: row.last_reminder_at,
	}));
}

/* ------------------------------------------------------------------ */
/* One case                                                            */
/* ------------------------------------------------------------------ */

export type CaseBooking = {
	id: string;
	status: BookingStatus;
	/** Null for a custom appointment. */
	sessionId: string | null;
	date: IsoDate;
	time: string;
	location: string;
	software: string[];
	bookedBy: string;
	bookedAt: Date;
	reason: string | null;
};

export type JournalItem = {
	id: string;
	at: Date;
	body: string;
	who: string;
	failed: boolean;
};

export type CaseDetail = {
	id: string;
	reference: string;
	status: CaseStatus;
	type: ReplacementType;
	archived: boolean;
	person: {
		name: string;
		firstName: string;
		email: string;
		username: string | null;
		jobTitle: string | null;
		department: string | null;
	};
	/** The device's assigned user in Halo, when someone else is receiving the laptop. */
	assignedUser: string | null;
	oldDevice: {
		assetId: string;
		serial: string | null;
		hostname: string | null;
		make: string | null;
		model: string | null;
	};
	boxNumber: string | null;
	flag: { kind: string; reason: string | null; by: string | null; at: Date } | null;
	invitedAt: Date | null;
	booking: CaseBooking | null;
	bookings: CaseBooking[];
	step: number | null;
	progress: {
		allocatedAt: Date | null;
		allocatedBy: string | null;
		devicePreparedAt: Date | null;
		devicePreparedBy: string | null;
		softwarePreparedAt: Date | null;
		softwarePreparedBy: string | null;
		attendedAt: Date | null;
		returnedAt: Date | null;
		returnedBy: string | null;
		decommissionedAt: Date | null;
		decommissionedBy: string | null;
	};
	closedAt: Date | null;
	withdrawnReason: string | null;
	journal: JournalItem[];
};

/** A case by reference (LR-000123), with everything its page shows. */
export async function getCase(reference: string): Promise<CaseDetail | null> {
	if (!/^LR-\d{6}$/.test(reference)) return null;
	const row = await queryOne<{
		id: string;
		reference: string;
		status: CaseStatus;
		type: ReplacementType;
		archived: boolean;
		name: string;
		email: string;
		username: string | null;
		job_title: string | null;
		department: string | null;
		assigned_user: string | null;
		old_asset_id: string;
		old_serial: string | null;
		old_hostname: string | null;
		old_make: string | null;
		old_model: string | null;
		box_number: string | null;
		flag_kind: string | null;
		flag_reason: string | null;
		flagged_by: string | null;
		flagged_at: Date | null;
		invited_at: Date | null;
		allocated_at: Date | null;
		allocated_by: string | null;
		device_prepared_at: Date | null;
		device_prepared_by: string | null;
		software_prepared_at: Date | null;
		software_prepared_by: string | null;
		attended_at: Date | null;
		returned_at: Date | null;
		returned_by: string | null;
		decommissioned_at: Date | null;
		decommissioned_by: string | null;
		closed_at: Date | null;
		withdrawn_reason: string | null;
	}>(
		`SELECT c.id, c.reference, c.status, c.session_type AS type, ${ARCHIVED} AS archived,
		        u.display_name AS name, u.email, u.username, u.job_title, u.department,
		        CASE WHEN c.halo_assigned_user_id IS DISTINCT FROM c.user_id THEN au.display_name END AS assigned_user,
		        c.old_asset_id, c.old_serial, c.old_hostname, c.old_make, c.old_model, c.box_number,
		        c.flag_kind, c.flag_reason, fb.display_name AS flagged_by, c.flagged_at, c.invited_at,
		        a.allocated_at, ab.display_name AS allocated_by,
		        c.device_prepared_at, dp.display_name AS device_prepared_by,
		        c.software_prepared_at, sp.display_name AS software_prepared_by,
		        c.attended_at, c.old_device_returned_at AS returned_at, rb.display_name AS returned_by,
		        c.decommissioned_at, db.display_name AS decommissioned_by,
		        c.closed_at, c.withdrawn_reason
		 FROM lr.cases c
		 JOIN portal.users u ON u.id = c.user_id
		 LEFT JOIN portal.users au ON au.id = c.halo_assigned_user_id
		 LEFT JOIN portal.users fb ON fb.id = c.flagged_by
		 LEFT JOIN lr.device_allocations a ON a.case_id = c.id AND a.removed_at IS NULL
		 LEFT JOIN portal.users ab ON ab.id = a.allocated_by
		 LEFT JOIN portal.users dp ON dp.id = c.device_prepared_by
		 LEFT JOIN portal.users sp ON sp.id = c.software_prepared_by
		 LEFT JOIN portal.users rb ON rb.id = c.old_device_returned_by
		 LEFT JOIN portal.users db ON db.id = c.decommissioned_by
		 WHERE c.reference = $1`,
		[reference],
	);
	if (!row) return null;

	const [bookings, journal] = await Promise.all([caseBookings(row.id), caseJournal(row.id)]);
	const booking = bookings.find((b) => b.status === "booked") ?? null;

	return {
		id: row.id,
		reference: row.reference,
		status: row.status,
		type: row.type,
		archived: row.archived,
		person: {
			name: row.name,
			firstName: row.name.split(" ")[0],
			email: row.email,
			username: row.username,
			jobTitle: row.job_title,
			department: row.department,
		},
		assignedUser: row.assigned_user,
		oldDevice: {
			assetId: row.old_asset_id,
			serial: row.old_serial,
			hostname: row.old_hostname,
			make: row.old_make,
			model: row.old_model,
		},
		boxNumber: row.box_number,
		flag:
			row.flag_kind && row.flagged_at
				? {
						kind: row.flag_kind,
						reason: row.flag_reason,
						by: row.flagged_by,
						at: row.flagged_at,
					}
				: null,
		invitedAt: row.invited_at,
		booking,
		bookings,
		step: currentStep({
			status: row.status,
			boxNumber: row.box_number,
			devicePreparedAt: row.device_prepared_at,
			softwarePreparedAt: row.software_prepared_at,
			softwareRequested: booking?.software ?? null,
		}),
		progress: {
			allocatedAt: row.allocated_at,
			allocatedBy: row.allocated_by,
			devicePreparedAt: row.device_prepared_at,
			devicePreparedBy: row.device_prepared_by,
			softwarePreparedAt: row.software_prepared_at,
			softwarePreparedBy: row.software_prepared_by,
			attendedAt: row.attended_at,
			returnedAt: row.returned_at,
			returnedBy: row.returned_by,
			decommissionedAt: row.decommissioned_at,
			decommissionedBy: row.decommissioned_by,
		},
		closedAt: row.closed_at,
		withdrawnReason: row.withdrawn_reason,
		journal,
	};
}

async function caseBookings(caseId: string): Promise<CaseBooking[]> {
	const rows = await query<{
		id: string;
		status: BookingStatus;
		session_id: string | null;
		date: IsoDate;
		time: string;
		location: string;
		software: string[];
		booked_by: string | null;
		person: string;
		created_at: Date;
		reason: string | null;
	}>(
		`SELECT b.id, b.status, b.session_id,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'YYYY-MM-DD') AS date,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON}, 'HH24:MI') AS time,
		        coalesce(s.location, b.custom_location) AS location,
		        b.software_requested AS software, bb.display_name AS booked_by,
		        u.display_name AS person, b.created_at, b.reason
		 FROM lr.bookings b
		 JOIN lr.cases c ON c.id = b.case_id
		 JOIN portal.users u ON u.id = c.user_id
		 LEFT JOIN lr.sessions s ON s.id = b.session_id
		 LEFT JOIN portal.users bb ON bb.id = b.booked_by
		 WHERE b.case_id = $1
		 ORDER BY b.created_at DESC, b.id DESC`,
		[caseId],
	);
	return rows.map((row) => ({
		id: row.id,
		status: row.status,
		sessionId: row.session_id,
		date: row.date,
		time: row.time,
		location: row.location,
		software: [...row.software].sort((a, b) => a.localeCompare(b)),
		bookedBy: row.booked_by ?? row.person,
		bookedAt: row.created_at,
		reason: row.reason,
	}));
}

async function caseJournal(caseId: string): Promise<JournalItem[]> {
	const rows = await query<{
		id: string;
		occurred_at: Date;
		body: string;
		actor: string | null;
		actor_system: string | null;
		outcome: string;
	}>(
		`SELECT j.id, j.occurred_at, j.body, u.display_name AS actor, j.actor_system, j.outcome
		 FROM lr.journal_entries j LEFT JOIN portal.users u ON u.id = j.actor_user_id
		 WHERE j.case_id = $1
		 ORDER BY j.occurred_at DESC, j.id DESC`,
		[caseId],
	);
	return rows.map((row) => ({
		id: row.id,
		at: row.occurred_at,
		body: row.body,
		who: row.actor ?? (row.actor_system ? `System · ${row.actor_system}` : "System"),
		failed: row.outcome === "failed",
	}));
}

/* ------------------------------------------------------------------ */
/* What the team can do                                                */
/* ------------------------------------------------------------------ */

export type CaseAction =
	| "resend-booking"
	| "resend-invitation"
	| "cancel-booking"
	| "did-not-attend"
	| "flag"
	| "clear-flag"
	| "withdraw"
	| "change-type"
	| "book-on-behalf"
	| "custom-appointment";

/**
 * The actions open to a case now (spec, "Actions panel"). Withdraw also
 * needs the service's admin role, checked where it is used. Archived cases
 * can't be changed.
 */
const WAITING_FOR_BOOKING: readonly CaseStatus[] = [
	"queued",
	"pending",
	"unbooked",
	"rebook_required",
];

export function availableActions(detail: CaseDetail, now: Date = new Date()): CaseAction[] {
	if (detail.archived || !BEFORE_COMPLETION.includes(detail.status)) return [];
	const actions: CaseAction[] = [];
	const booked = detail.status === "booked" && detail.booking;
	if (booked) actions.push("resend-booking");
	if (detail.status !== "queued") actions.push("resend-invitation");
	if (booked) {
		actions.push("cancel-booking");
		// Once the day of the booking has come.
		if ((detail.booking?.date ?? "9999-12-31") <= londonToday(now))
			actions.push("did-not-attend");
	}
	if (detail.flag) actions.push("clear-flag");
	else if (["queued", "pending", "rebook_required"].includes(detail.status)) actions.push("flag");
	if (!detail.booking) actions.push("change-type");
	// A booked case can use this to move to another published session.
	if (
		(detail.booking && detail.status === "booked") ||
		(!detail.booking && WAITING_FOR_BOOKING.includes(detail.status))
	)
		actions.push("book-on-behalf");
	if (detail.status === "unbooked" || (detail.status === "booked" && detail.booking))
		actions.push("custom-appointment");
	actions.push("withdraw");
	return actions;
}

export type ActionResult = { ok: true } | { ok: false; error: string; emailFailed?: boolean };

const NOT_ALLOWED: ActionResult = { ok: false, error: "This can’t be done to the case now" };

function trigger(label: string, actorId: string): CallTrigger {
	return { kind: "user", label, actorUserId: actorId };
}

async function email(
	key: LaptopEmailKey,
	detail: CaseDetail,
	actorId: string,
	label: string,
): Promise<SendEmailResult> {
	return sendCaseEmail({
		key,
		caseId: detail.id,
		trigger: trigger(label, actorId),
		actor: { userId: actorId },
	});
}

function emailFailed(sent: SendEmailResult): ActionResult {
	return {
		ok: false,
		emailFailed: true,
		error: `The email could not be sent (${sent.ok ? "" : sent.message}). Nothing has changed.`,
	};
}

export async function addNote(detail: CaseDetail, text: string, actorId: string) {
	await withTransaction(
		(tx) =>
			addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "note",
				body: text,
			}),
		{ actingUserId: actorId },
	);
}

/** Resend booking details: the booking confirmation email again. */
export async function resendBookingDetails(
	detail: CaseDetail,
	actorId: string,
): Promise<ActionResult> {
	if (!availableActions(detail).includes("resend-booking")) return NOT_ALLOWED;
	const sent = await email("booking_confirmed", detail, actorId, "Resend booking details");
	return sent.ok ? { ok: true } : emailFailed(sent);
}

/**
 * Resend invitation: the same invitation email. An Unbooked case goes back to
 * Pending with its flag cleared and reminders restarting (spec, "Unbooked").
 */
export async function resendInvitation(detail: CaseDetail, actorId: string): Promise<ActionResult> {
	if (!availableActions(detail).includes("resend-invitation")) return NOT_ALLOWED;
	const sent = await email("invitation", detail, actorId, "Resend invitation");
	if (!sent.ok) return emailFailed(sent);
	if (detail.status === "unbooked") {
		await withTransaction(
			async (tx) => {
				await query(
					`UPDATE lr.cases
					 SET status = 'pending', invited_at = now(), reminders_sent = 0, reminders_paused = false,
					     flag_kind = NULL, flag_reason = NULL, flagged_by = NULL, flagged_at = NULL
					 WHERE id = $1`,
					[detail.id],
					tx,
				);
				await addJournalEntry(tx, {
					caseId: detail.id,
					actor: { userId: actorId },
					kind: "status",
					body: "Invitation resent: back to Pending, flag cleared and reminders restarted",
				});
			},
			{ actingUserId: actorId },
		);
	}
	return { ok: true };
}

/** Moves a booked case to Rebook required. Reminders start again from zero. */
async function toRebookRequired(
	tx: Queryable,
	detail: CaseDetail,
	bookingStatus: BookingStatus,
	reason: string | null,
	actorId: string,
	body: string,
) {
	await query(
		"UPDATE lr.bookings SET status = $2, reason = $3 WHERE id = $1",
		[detail.booking?.id, bookingStatus, reason],
		tx,
	);
	await query(
		`UPDATE lr.cases
		 SET status = 'rebook_required', rebook_requested_at = now(), reminders_sent = 0, reminders_paused = false
		 WHERE id = $1`,
		[detail.id],
		tx,
	);
	await addJournalEntry(tx, {
		caseId: detail.id,
		actor: { userId: actorId },
		kind: "booking",
		body,
		data: { booking_id: Number(detail.booking?.id), reason },
	});
}

/** Cancel booking: emails the person to rebook first, then cancels. The device stays allocated. */
export async function cancelBooking(detail: CaseDetail, actorId: string): Promise<ActionResult> {
	if (!availableActions(detail).includes("cancel-booking")) return NOT_ALLOWED;
	const sent = await email("rebook_needed", detail, actorId, "Cancel booking");
	if (!sent.ok) return emailFailed(sent);
	await withTransaction(
		(tx) =>
			toRebookRequired(
				tx,
				detail,
				"cancelled",
				"Cancelled by the team",
				actorId,
				"Booking cancelled by the team",
			),
		{ actingUserId: actorId },
	);
	return { ok: true };
}

/** Record did not attend or unsuccessful: emails the person to rebook first. */
export async function recordOutcome(
	detail: CaseDetail,
	outcome: "did_not_attend" | "unsuccessful",
	reason: string,
	actorId: string,
): Promise<ActionResult> {
	if (!availableActions(detail).includes("did-not-attend")) return NOT_ALLOWED;
	const sent = await email("rebook_needed", detail, actorId, "Record did not attend");
	if (!sent.ok) return emailFailed(sent);
	const label = outcome === "did_not_attend" ? "Did not attend" : "Unsuccessful";
	await withTransaction(
		(tx) =>
			toRebookRequired(
				tx,
				detail,
				outcome,
				reason || null,
				actorId,
				reason ? `Booking marked ${label}: ${reason}` : `Booking marked ${label}`,
			),
		{ actingUserId: actorId },
	);
	return { ok: true };
}

/** Flag a case that isn't booked yet, with a reason. Never changes the status or reminders. */
export async function flagCase(
	detail: CaseDetail,
	reason: string,
	actorId: string,
): Promise<ActionResult> {
	if (!availableActions(detail).includes("flag")) return NOT_ALLOWED;
	await withTransaction(
		async (tx) => {
			await query(
				`UPDATE lr.cases
				 SET flag_kind = 'manual', flag_reason = $2, flagged_by = $3, flagged_at = now()
				 WHERE id = $1`,
				[detail.id, reason, actorId],
				tx,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "flag",
				body: `Flagged: ${reason}`,
			});
		},
		{ actingUserId: actorId },
	);
	return { ok: true };
}

export async function clearFlag(detail: CaseDetail, actorId: string): Promise<ActionResult> {
	if (!availableActions(detail).includes("clear-flag")) return NOT_ALLOWED;
	await withTransaction(
		async (tx) => {
			await query(
				`UPDATE lr.cases SET flag_kind = NULL, flag_reason = NULL, flagged_by = NULL, flagged_at = NULL
				 WHERE id = $1`,
				[detail.id],
				tx,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "flag",
				body: detail.flag?.reason
					? `Flag cleared (was: ${detail.flag.reason})`
					: "Flag cleared",
			});
		},
		{ actingUserId: actorId },
	);
	return { ok: true };
}

/** Change the type until the case has a booking. */
export async function changeCaseType(
	detail: CaseDetail,
	type: ReplacementType,
	actorId: string,
): Promise<ActionResult> {
	if (!availableActions(detail).includes("change-type")) return NOT_ALLOWED;
	if (type === detail.type) return { ok: true };
	const label = (t: ReplacementType) => (t === "collection" ? "Collection" : "Session");
	await withTransaction(
		async (tx) => {
			await query(
				"UPDATE lr.cases SET session_type = $2 WHERE id = $1",
				[detail.id, type],
				tx,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "status",
				body: `Type changed from ${label(detail.type)} to ${label(type)}`,
				data: { from: detail.type, to: type },
			});
		},
		{ actingUserId: actorId },
	);
	return { ok: true };
}

/**
 * Withdraw case: needs a reason; cancels any booking, returns an allocated
 * device to stock and sends nothing to the person (spec, "Withdraw").
 */
export async function withdrawCase(
	detail: CaseDetail,
	reason: string,
	actorId: string,
): Promise<ActionResult> {
	if (!availableActions(detail).includes("withdraw")) return NOT_ALLOWED;
	await withTransaction(
		async (tx) => {
			await query(
				"UPDATE lr.bookings SET status = 'cancelled', reason = 'Case withdrawn' WHERE case_id = $1 AND status = 'booked'",
				[detail.id],
				tx,
			);
			if (detail.boxNumber) {
				await query(
					`UPDATE lr.device_allocations
					 SET removed_at = now(), removed_by = $2, outcome = 'case_withdrawn', removed_reason = $3
					 WHERE case_id = $1 AND removed_at IS NULL`,
					[detail.id, actorId, reason],
					tx,
				);
				await query(
					`INSERT INTO lr.device_journal (box_number, actor_user_id, kind, case_id, body)
					 VALUES ($1, $2, 'allocation', $3, $4)`,
					[
						detail.boxNumber,
						actorId,
						detail.id,
						`Back in stock: case ${detail.reference} was withdrawn`,
					],
					tx,
				);
			}
			await query(
				`UPDATE lr.cases
				 SET status = 'withdrawn', closed_at = now(), withdrawn_reason = $2, box_number = NULL,
				     flag_kind = NULL, flag_reason = NULL, flagged_by = NULL, flagged_at = NULL
				 WHERE id = $1`,
				[detail.id, reason],
				tx,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "status",
				body: `Withdrawn: ${reason}`,
				data: { box_returned: detail.boxNumber },
			});
		},
		{ actingUserId: actorId },
	);
	return { ok: true };
}
