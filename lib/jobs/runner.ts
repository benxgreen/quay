import "server-only";

import type { CallTrigger } from "@/lib/clients/connection-log";
import type { IsoDate } from "@/lib/dates/working-days";
import { query, queryOne } from "@/lib/db/query";

/** How a job was started: by the timer, or by someone in development. */
export type JobStart = {
	/** The day the job runs for: today, or a "run as if today is" date in development. */
	day: IsoDate;
	asIf: boolean;
	/** The person who ran it on demand; left out when the timer ran it. */
	userId?: string;
};

/** What a job is given while it runs. */
export type JobContext = JobStart & {
	runId: number;
	/** The service the job belongs to, such as "laptop_replacements". */
	service: string;
	/** The job's name, such as "Send invitations"; used for the journal and connection log. */
	name: string;
	trigger: CallTrigger;
	/** Who did it, for the service's journal: the job's name. */
	actor: { system: string };
	/** Logs a case the run touched, and counts it as processed or failed. */
	logCase(entry: {
		caseId: string | number;
		bookingId?: string | number | null;
		outcome: "sent" | "failed";
		detail?: string;
	}): Promise<void>;
	/** Records why the job did nothing today, such as "Not a working day". */
	note(text: string): void;
};

export type JobRunSummary = {
	runId: number;
	processed: number;
	failed: number;
	note: string | null;
	error: string | null;
};

/**
 * Runs one of a service's jobs and writes the portal's job log: a row in
 * portal.job_runs when it starts, one in portal.job_run_cases for each case
 * it touches, and the totals (or the error that stopped it) when it ends. A
 * run that fails part way keeps what it logged, so a re-run picks up where
 * it left off. Only one run of each service's job at a time.
 */
export async function runLogged(
	service: string,
	key: string,
	name: string,
	start: JobStart,
	work: (context: JobContext) => Promise<void>,
): Promise<JobRunSummary> {
	// A run that never finished (the app restarted part way) would block the job for ever.
	await query(
		`UPDATE portal.job_runs SET finished_at = now(), error = 'Did not finish'
		 WHERE service = $1 AND job = $2 AND finished_at IS NULL AND started_at < now() - interval '1 hour'`,
		[service, key],
	);
	let run: { id: string } | undefined;
	try {
		run = await queryOne<{ id: string }>(
			`INSERT INTO portal.job_runs (service, job, run_date, as_if, triggered_by)
			 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			[service, key, start.day, start.asIf, start.userId ?? null],
		);
	} catch (error) {
		if ((error as { constraint?: string }).constraint === "job_runs_one_running") {
			throw new Error(`${name} is already running`);
		}
		throw error;
	}
	const runId = Number(run?.id);

	let processed = 0;
	let failed = 0;
	let note: string | null = null;
	let error: string | null = null;
	try {
		await work({
			...start,
			runId,
			name,
			trigger: start.userId
				? { kind: "user", label: name, actorUserId: start.userId }
				: { kind: "schedule", label: name },
			service,
			actor: { system: name },
			async logCase(entry) {
				await query(
					`INSERT INTO portal.job_run_cases (job_run_id, case_id, booking_id, outcome, detail)
					 VALUES ($1, $2, $3, $4, $5)`,
					[
						runId,
						entry.caseId,
						entry.bookingId ?? null,
						entry.outcome,
						entry.detail ?? null,
					],
				);
				if (entry.outcome === "sent") processed += 1;
				else failed += 1;
			},
			note(text) {
				note = text;
			},
		});
	} catch (caught) {
		error = caught instanceof Error ? caught.message : String(caught);
		console.error(`Job ${key} (run ${runId}) stopped`, caught);
	}

	await query(
		`UPDATE portal.job_runs SET finished_at = now(), processed = $2, failed = $3, note = $4, error = $5
		 WHERE id = $1`,
		[runId, processed, failed, note, error],
	);
	return { runId, processed, failed, note, error };
}

/**
 * The SQL condition for "this job has already sent to this case today",
 * which keeps a re-run from sending twice. The numbers are the parameter
 * positions holding the service, the job key and the run's day.
 */
export function notSentToday(
	caseColumn: string,
	{ service, job, day }: { service: number; job: number; day: number },
): string {
	return `NOT EXISTS (
		SELECT 1 FROM portal.job_run_cases jc JOIN portal.job_runs r ON r.id = jc.job_run_id
		WHERE jc.case_id = ${caseColumn} AND jc.outcome = 'sent'
		  AND r.service = $${service} AND r.job = $${job} AND r.run_date = $${day}
	)`;
}
