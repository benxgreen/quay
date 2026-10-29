import "server-only";

import { getPool } from "@/lib/db/pool";
import type { Queryable } from "@/lib/db/query";
import { queryOne } from "@/lib/db/query";
import type { FailedCall } from "@/lib/external-first";

export type JournalKind =
	| "note"
	| "status"
	| "email"
	| "booking"
	| "flag"
	| "allocation"
	| "checklist"
	| "software"
	| "availability"
	| "import";

/** A person, or the job that did it, such as "Send invitations". */
export type JournalActor = { userId: string } | { system: string };

export type JournalEntry = {
	caseId: number | string;
	actor: JournalActor;
	kind: JournalKind;
	/** The sentence shown in the journal. */
	body: string;
	data?: Record<string, unknown>;
	/** "failed" when the action's external call failed; shown with a Failed tag. */
	outcome?: "success" | "failed";
};

/**
 * Writes one journal entry. Every action writes one, inside its own
 * transaction when it succeeds. Entries are never edited or deleted.
 */
export async function addJournalEntry(db: Queryable, entry: JournalEntry): Promise<number> {
	const row = await queryOne<{ id: string }>(
		`INSERT INTO lr.journal_entries
		   (case_id, actor_user_id, actor_system, kind, body, data, outcome)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id`,
		[
			entry.caseId,
			"userId" in entry.actor ? entry.actor.userId : null,
			"system" in entry.actor ? entry.actor.system : null,
			entry.kind,
			entry.body,
			entry.data ?? null,
			entry.outcome ?? "success",
		],
		db,
	);
	return Number(row?.id);
}

/**
 * For externalFirst's `recordFailure`: journals an action whose external
 * call failed, with a Failed tag, such as "Complete replacement failed: Halo
 * returned 503 Service Unavailable". Nothing else about the case changes.
 */
export function journalFailure(
	{
		caseId,
		actor,
		kind,
		action,
	}: { caseId: number | string; actor: JournalActor; kind: JournalKind; action: string },
	db: Queryable = getPool(),
): (failure: FailedCall) => Promise<number> {
	return (failure) =>
		addJournalEntry(db, {
			caseId,
			actor,
			kind,
			body: `${action} failed: ${failure.message}`,
			data: {
				connection: failure.connection,
				status_code: failure.statusCode ?? null,
				timed_out: failure.timedOut,
				connection_log_id: failure.logId ?? null,
			},
			outcome: "failed",
		});
}
