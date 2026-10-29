import "server-only";

import { queryOne } from "@/lib/db/query";

/** What started a call, as shown in Settings › Connection log. */
export type CallTrigger = {
	kind: "schedule" | "user" | "system";
	/** For example "Daily invitations", "Refresh from Halo", "Session cancelled email". */
	label: string;
	/** Required when kind is "user". */
	actorUserId?: string;
};

export type CallContext = {
	trigger: CallTrigger;
	/** The case the call is for, if any. */
	caseId?: number | string;
};

/** What a call returns to callExternal: its value, plus what to write in the log. */
export type CallOutcome<T> = {
	value: T;
	statusCode?: number;
	/** A few words for the log, such as "64 laptops" or "15 sent". */
	summary?: string;
};

export type CallResult<T> = {
	value: T;
	/** The connection that was called, such as "halo". */
	connection: string;
	/** The lr.connection_log row, or undefined if the log could not be written. */
	logId?: number;
};

/** A call to an external system failed or timed out. Nothing should be saved. */
export class ExternalCallError extends Error {
	readonly connection: string;
	readonly statusCode?: number;
	readonly timedOut: boolean;
	readonly logId?: number;
	readonly at: Date;

	constructor(options: {
		connection: string;
		message: string;
		statusCode?: number;
		timedOut?: boolean;
		logId?: number;
		at?: Date;
		cause?: unknown;
	}) {
		super(options.message, { cause: options.cause });
		this.name = "ExternalCallError";
		this.connection = options.connection;
		this.statusCode = options.statusCode;
		this.timedOut = options.timedOut ?? false;
		this.logId = options.logId;
		this.at = options.at ?? new Date();
	}
}

/** An HTTP response that was not a success, raised by clients so the status reaches the log. */
export class HttpStatusError extends Error {
	constructor(
		readonly statusCode: number,
		message = `Returned ${statusCode}`,
	) {
		super(message);
		this.name = "HttpStatusError";
	}
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Makes one call to an external system and writes it to lr.connection_log,
 * successful or not. Each client names its own connection (halo,
 * email_webhook). On failure or timeout it throws ExternalCallError, which
 * the page turns into a red Failed banner; nothing has been saved by then,
 * because external calls always come first.
 *
 * @example
 * const { value } = await callExternal("halo", context, async (signal) => {
 *   const response = await fetch(url, { signal });
 *   if (!response.ok) throw new HttpStatusError(response.status);
 *   const devices = await response.json();
 *   return { value: devices, statusCode: response.status, summary: `${devices.length} devices` };
 * });
 */
export async function callExternal<T>(
	connection: string,
	context: CallContext,
	call: (signal: AbortSignal) => Promise<CallOutcome<T>>,
	{ timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<CallResult<T>> {
	const started = Date.now();
	const signal = AbortSignal.timeout(timeoutMs);

	try {
		const outcome = await call(signal);
		const logId = await writeLog({
			connection,
			context,
			outcome: "success",
			statusCode: outcome.statusCode,
			summary: outcome.summary,
			durationMs: Date.now() - started,
		});
		return { value: outcome.value, connection, logId };
	} catch (error) {
		const timedOut = signal.aborted;
		const statusCode = error instanceof HttpStatusError ? error.statusCode : undefined;
		const message = timedOut
			? `No response within ${Math.round(timeoutMs / 1000)} seconds`
			: error instanceof Error
				? error.message
				: String(error);
		const logId = await writeLog({
			connection,
			context,
			outcome: "failed",
			statusCode,
			error: message,
			durationMs: Date.now() - started,
		});
		throw new ExternalCallError({
			connection,
			message,
			statusCode,
			timedOut,
			logId,
			cause: error,
		});
	}
}

async function writeLog(entry: {
	connection: string;
	context: CallContext;
	outcome: "success" | "failed";
	statusCode?: number;
	summary?: string;
	error?: string;
	durationMs: number;
}): Promise<number | undefined> {
	try {
		const row = await queryOne<{ id: string }>(
			`INSERT INTO lr.connection_log
			   (connection, trigger_kind, trigger_label, actor_user_id, case_id,
			    outcome, status_code, summary, error, duration_ms)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 RETURNING id`,
			[
				entry.connection,
				entry.context.trigger.kind,
				entry.context.trigger.label,
				entry.context.trigger.actorUserId ?? null,
				entry.context.caseId ?? null,
				entry.outcome,
				entry.statusCode ?? null,
				entry.summary ?? null,
				entry.error ?? null,
				entry.durationMs,
			],
		);
		return row ? Number(row.id) : undefined;
	} catch (logError) {
		// A broken log must not hide what happened to the call itself.
		console.error("Could not write lr.connection_log", logError);
		return undefined;
	}
}
