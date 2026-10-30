import "server-only";

import { query, queryOne } from "@/lib/db/query";
import { isJobKey, JOBS } from "./index";

export type JobRun = {
	id: string;
	job: string;
	name: string;
	runDate: string;
	asIf: boolean;
	startedAt: Date;
	finishedAt: Date | null;
	processed: number;
	failed: number;
	note: string | null;
	error: string | null;
	triggeredBy: string | null;
};

export type JobRunCase = {
	reference: string;
	personName: string;
	outcome: "sent" | "failed";
	detail: string | null;
	at: Date;
};

type JobRunRow = {
	id: string;
	job: string;
	run_date: string;
	as_if: boolean;
	started_at: Date;
	finished_at: Date | null;
	processed: number;
	failed: number;
	note: string | null;
	error: string | null;
	triggered_by: string | null;
};

const RUN_COLUMNS = `r.id, r.job, r.run_date, r.as_if, r.started_at, r.finished_at, r.processed,
	r.failed, r.note, r.error, u.display_name AS triggered_by`;

function toRun(row: JobRunRow): JobRun {
	return {
		id: row.id,
		job: row.job,
		name: isJobKey(row.job) ? JOBS[row.job].name : row.job,
		runDate: row.run_date,
		asIf: row.as_if,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		processed: row.processed,
		failed: row.failed,
		note: row.note,
		error: row.error,
		triggeredBy: row.triggered_by,
	};
}

/** The latest job runs, newest first. */
export async function listJobRuns(limit: number): Promise<{ runs: JobRun[]; total: number }> {
	const [rows, count] = await Promise.all([
		query<JobRunRow>(
			`SELECT ${RUN_COLUMNS} FROM lr.job_runs r
			 LEFT JOIN portal.users u ON u.id = r.triggered_by
			 ORDER BY r.started_at DESC, r.id DESC LIMIT $1`,
			[limit],
		),
		queryOne<{ n: number }>("SELECT count(*)::integer AS n FROM lr.job_runs"),
	]);
	return { runs: rows.map(toRun), total: count?.n ?? 0 };
}

/** Each job's latest run, for the list of jobs. */
export async function latestRuns(): Promise<Map<string, JobRun>> {
	const rows = await query<JobRunRow>(
		`SELECT DISTINCT ON (r.job) ${RUN_COLUMNS} FROM lr.job_runs r
		 LEFT JOIN portal.users u ON u.id = r.triggered_by
		 ORDER BY r.job, r.started_at DESC, r.id DESC`,
	);
	return new Map(rows.map((row) => [row.job, toRun(row)]));
}

/** One run and the cases it touched. */
export async function getJobRun(id: string): Promise<{ run: JobRun; cases: JobRunCase[] } | null> {
	if (!/^\d+$/.test(id)) return null;
	const row = await queryOne<JobRunRow>(
		`SELECT ${RUN_COLUMNS} FROM lr.job_runs r
		 LEFT JOIN portal.users u ON u.id = r.triggered_by
		 WHERE r.id = $1`,
		[id],
	);
	if (!row) return null;
	const cases = await query<{
		reference: string;
		person_name: string;
		outcome: "sent" | "failed";
		detail: string | null;
		created_at: Date;
	}>(
		`SELECT c.reference, u.display_name AS person_name, jc.outcome, jc.detail, jc.created_at
		 FROM lr.job_run_cases jc
		 JOIN lr.cases c ON c.id = jc.case_id
		 JOIN portal.users u ON u.id = c.user_id
		 WHERE jc.job_run_id = $1
		 ORDER BY jc.id`,
		[id],
	);
	return {
		run: toRun(row),
		cases: cases.map((c) => ({
			reference: c.reference,
			personName: c.person_name,
			outcome: c.outcome,
			detail: c.detail,
			at: c.created_at,
		})),
	};
}
