import "server-only";

import type pg from "pg";
import { type CallResult, ExternalCallError } from "@/lib/clients/connection-log";
import { ConnectionNotConfiguredError } from "@/lib/clients/connections";
import { withTransaction } from "@/lib/db/transaction";

/** What the red Failed banner needs to say. */
export type FailedCall = {
	connection: string;
	/** The response or timeout, such as "Halo returned 503 Service Unavailable". */
	message: string;
	statusCode?: number;
	timedOut: boolean;
	at: Date;
	/** The lr.connection_log row, for the "Connection log" link. Absent if the call was never made. */
	logId?: number;
};

export type ExternalFirstResult<T> = { ok: true; value: T } | { ok: false; failure: FailedCall };

/**
 * The call succeeded but saving afterwards failed, so the external system and
 * the portal disagree. Rare (the save is checked before the call where it
 * can be), but it must be fixed by hand, so it is thrown loudly rather than
 * shown as a normal Failed banner.
 */
export class SaveAfterCallError extends Error {
	constructor(
		readonly connection: string,
		cause: unknown,
	) {
		super(
			`The ${connection} call succeeded but saving the change in the portal failed. Check the connection log and correct the record.`,
			{ cause },
		);
		this.name = "SaveAfterCallError";
	}
}

type ExternalFirstOptions<C, T> = {
	/** The external call, through a client, so it is logged. */
	call: () => Promise<CallResult<C>>;
	/** Saves the change and writes the journal, in one transaction, only after the call succeeded. */
	save: (tx: Pick<pg.PoolClient, "query">, called: CallResult<C>) => Promise<T>;
	/** The signed-in user, recorded as the acting user in the transaction. */
	actingUserId?: string;
	/**
	 * Records the failed attempt, such as a journal entry with a Failed tag.
	 * Nothing else changes. If recording fails it is logged, and the caller
	 * still gets the failure.
	 */
	recordFailure?: (failure: FailedCall) => Promise<unknown>;
};

/**
 * The portal's rule for anything that calls Halo or Power Automate: make the
 * call first; only if it succeeds, save to the database and write the
 * journal. If the call fails, nothing changes except `recordFailure` (the
 * journal entry with a Failed tag), and the page shows a red Failed banner
 * with what failed and a link to the connection log. The call itself is
 * always in the connection log.
 *
 * @example
 * const result = await externalFirst({
 *   call: () => halo.issueDevice({ assetId: box, issuedTo: email, date: today }, context),
 *   save: (tx) => completeReplacement(tx, caseId),
 *   actingUserId: user.id,
 *   recordFailure: journalFailure({ caseId, actor: { userId: user.id }, kind: "status", action: "Complete replacement" }),
 * });
 * if (!result.ok) return { failed: result.failure };
 */
export async function externalFirst<C, T>({
	call,
	save,
	actingUserId,
	recordFailure,
}: ExternalFirstOptions<C, T>): Promise<ExternalFirstResult<T>> {
	let called: CallResult<C>;
	try {
		called = await call();
	} catch (error) {
		const failure = describeFailure(error);
		if (!failure) throw error;
		try {
			await recordFailure?.(failure);
		} catch (recordError) {
			console.error("Could not record the failed call", { failure, recordError });
		}
		return { ok: false, failure };
	}

	try {
		const value = await withTransaction((tx) => save(tx, called), { actingUserId });
		return { ok: true, value };
	} catch (error) {
		console.error("Saved externally but not in the portal", {
			connection: called.connection,
			logId: called.logId,
			error,
		});
		throw new SaveAfterCallError(called.connection, error);
	}
}

function describeFailure(error: unknown): FailedCall | undefined {
	if (error instanceof ExternalCallError) {
		return {
			connection: error.connection,
			message: error.message,
			statusCode: error.statusCode,
			timedOut: error.timedOut,
			at: error.at,
			logId: error.logId,
		};
	}
	if (error instanceof ConnectionNotConfiguredError) {
		return {
			connection: error.connection,
			message: error.message,
			timedOut: false,
			at: new Date(),
		};
	}
	return undefined;
}
