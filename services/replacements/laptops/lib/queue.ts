import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { getBankHolidaysClient } from "@/lib/clients/bank-holidays";
import type { IsoDate } from "@/lib/dates/working-days";
import { query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import {
	estimatedInvitation,
	invitationRunDays,
} from "@/services/replacements/laptops/lib/invitation-dates";
import { addJournalEntry } from "@/services/replacements/laptops/lib/journal";

/**
 * The invitation queue (spec, "Import"): Queued cases in invitation order,
 * oldest queued first. The 9am job invites up to the daily limit from the
 * front each working day.
 */

export type QueueEntry = {
	caseId: string;
	reference: string;
	position: number;
	name: string;
	email: string;
	serial: string | null;
	hostname: string | null;
	type: ReplacementType;
	/** When the case was added. Moving it to the front changes its order, not this. */
	addedAt: Date;
	estimate: IsoDate | null;
};

const QUEUE = `
	SELECT c.id AS case_id, c.reference, u.display_name AS name, u.email,
	       c.old_serial AS serial, c.old_hostname AS hostname, c.session_type AS type,
	       c.created_at AS added_at,
	       row_number() OVER (ORDER BY c.queued_at, c.id) AS position
	FROM lr.cases c JOIN portal.users u ON u.id = c.user_id
	WHERE c.status = 'queued'`;

/** The queue, or the cases matching a search with their place numbers kept. */
export async function listQueue(
	search = "",
	now: Date = new Date(),
): Promise<{ total: number; perDay: number; entries: QueueEntry[] }> {
	const like = `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`;
	const [rows, total, estimate] = await Promise.all([
		query<{
			case_id: string;
			reference: string;
			name: string;
			email: string;
			serial: string | null;
			hostname: string | null;
			type: ReplacementType;
			added_at: Date;
			position: string;
		}>(
			`SELECT * FROM (${QUEUE}) q
			 WHERE $1 = '%%' OR q.name ILIKE $1 OR q.email ILIKE $1 OR q.serial ILIKE $1
			    OR q.hostname ILIKE $1 OR q.reference ILIKE $1
			 ORDER BY q.position`,
			[like],
		),
		queueLength(),
		estimator(now),
	]);
	return {
		total,
		perDay: estimate.perDay,
		entries: rows.map((row) => {
			const position = Number(row.position);
			return {
				caseId: row.case_id,
				reference: row.reference,
				position,
				name: row.name,
				email: row.email,
				serial: row.serial,
				hostname: row.hostname,
				type: row.type,
				addedAt: row.added_at,
				estimate: estimate.at(position),
			};
		}),
	};
}

export async function queueLength(): Promise<number> {
	const row = await queryOne<{ count: string }>(
		"SELECT count(*) FROM lr.cases WHERE status = 'queued'",
	);
	return Number(row?.count ?? 0);
}

/**
 * Works out invitation dates from the daily limit (Settings) and the
 * working days ahead. If the bank holidays can't be read, weekends are
 * still skipped.
 */
export async function estimator(now: Date = new Date()) {
	const [settings, holidays] = await Promise.all([
		queryOne<{ per_day: number }>(
			"SELECT invitations_per_working_day AS per_day FROM lr.settings WHERE id = 1",
		),
		getBankHolidaysClient()
			.englandAndWales()
			.catch(() => [] as IsoDate[]),
	]);
	const perDay = settings?.per_day ?? 15;
	const total = await queueLength();
	const runDays = invitationRunDays(
		londonNow(now),
		holidays,
		Math.ceil((total + 200) / perDay) + 1,
	);
	return {
		perDay,
		runDays,
		at: (position: number) => estimatedInvitation(position, perDay, runDays),
	};
}

const LONDON = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Europe/London",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

function londonNow(now: Date): { day: IsoDate; time: string } {
	const parts = Object.fromEntries(
		LONDON.formatToParts(now).map((part) => [part.type, part.value]),
	);
	return {
		day: `${parts.year}-${parts.month}-${parts.day}`,
		time: `${parts.hour}:${parts.minute}`,
	};
}

export type QueuedCaseDetail = {
	caseId: string;
	reference: string;
	name: string;
	firstName: string;
	type: ReplacementType;
	position: number;
};

/** One Queued case with its place, or null if it isn't queued any more. */
export async function getQueuedCase(caseId: string): Promise<QueuedCaseDetail | null> {
	if (!/^\d+$/.test(caseId)) return null;
	const row = await queryOne<{
		case_id: string;
		reference: string;
		name: string;
		type: ReplacementType;
		position: string;
	}>(`SELECT * FROM (${QUEUE}) q WHERE q.case_id = $1`, [caseId]);
	return row
		? {
				caseId: row.case_id,
				reference: row.reference,
				name: row.name,
				firstName: row.name.split(" ")[0],
				type: row.type,
				position: Number(row.position),
			}
		: null;
}

/** Puts a Queued case first in the queue. */
export async function moveToFront(caseId: string, actorId: string): Promise<boolean> {
	return withTransaction(
		async (tx) => {
			const moved = await query(
				`UPDATE lr.cases
				 SET queued_at = (SELECT min(queued_at) FROM lr.cases WHERE status = 'queued') - interval '1 second'
				 WHERE id = $1 AND status = 'queued'
				 RETURNING id`,
				[caseId],
				tx,
			);
			if (moved.length === 0) return false;
			await addJournalEntry(tx, {
				caseId,
				actor: { userId: actorId },
				kind: "import",
				body: "Moved to the front of the invitation queue",
			});
			return true;
		},
		{ actingUserId: actorId },
	);
}

/** Changes a Queued case's type. It keeps its place in the queue. */
export async function changeQueuedType(
	caseId: string,
	type: ReplacementType,
	actorId: string,
): Promise<boolean> {
	return withTransaction(
		async (tx) => {
			const before = await queryOne<{ type: ReplacementType }>(
				"SELECT session_type AS type FROM lr.cases WHERE id = $1 AND status = 'queued' FOR UPDATE",
				[caseId],
				tx,
			);
			if (!before) return false;
			if (before.type === type) return true;
			await query("UPDATE lr.cases SET session_type = $2 WHERE id = $1", [caseId, type], tx);
			await addJournalEntry(tx, {
				caseId,
				actor: { userId: actorId },
				kind: "status",
				body: `Type changed from ${label(before.type)} to ${label(type)}`,
				data: { from: before.type, to: type },
			});
			return true;
		},
		{ actingUserId: actorId },
	);
}

/** The withdrawn reason written when a case is removed from the queue. */
export const REMOVED_FROM_QUEUE = "Removed from the invitation queue";

/**
 * Removes a case from the queue by withdrawing it. Its laptop shows on
 * Eligible devices again, so it can be queued afresh.
 */
export async function removeFromQueue(caseId: string, actorId: string): Promise<boolean> {
	return withTransaction(
		async (tx) => {
			const removed = await query(
				`UPDATE lr.cases
				 SET status = 'withdrawn', closed_at = now(), withdrawn_reason = $2
				 WHERE id = $1 AND status = 'queued'
				 RETURNING id`,
				[caseId, REMOVED_FROM_QUEUE],
				tx,
			);
			if (removed.length === 0) return false;
			await addJournalEntry(tx, {
				caseId,
				actor: { userId: actorId },
				kind: "status",
				body: "Withdrawn: removed from the invitation queue",
			});
			return true;
		},
		{ actingUserId: actorId },
	);
}

function label(type: ReplacementType): string {
	return type === "collection" ? "Collection" : "Session";
}
