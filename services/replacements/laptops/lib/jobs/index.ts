import "server-only";

import { getBankHolidaysClient } from "@/lib/clients/bank-holidays";
import {
	addWorkingDays,
	type IsoDate,
	isWeeklySendDay,
	isWorkingDay,
} from "@/lib/dates/working-days";
import { query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import { sendCaseEmail } from "@/services/replacements/laptops/lib/emails/send";
import { addJournalEntry } from "@/services/replacements/laptops/lib/journal";
import {
	type JobContext,
	type JobRunSummary,
	type JobStart,
	notSentToday,
	runLogged,
} from "./runner";

type JobSettings = {
	invitations_per_working_day: number;
	first_reminder_after_days: number;
	reminder_weekday: number;
	flag_after_reminders: number;
	software_lock_working_days: number;
	return_reminders_enabled: boolean;
	return_reminder_weekday: number;
};

/** What every job reads once per batch. */
type JobEnvironment = { settings: JobSettings; holidays: IsoDate[] };

type JobDefinition = {
	name: string;
	/** When it runs, in the words of the spec. */
	runs: string;
	run(context: JobContext, environment: JobEnvironment): Promise<void>;
};

/**
 * The scheduled jobs (spec, "Scheduled jobs and events"; schema doc,
 * "Scheduled jobs"), in the order the 9am batch runs them. Every job is
 * idempotent: it selects by status and by what the job log says it has
 * already sent for the day, so a re-run never sends a duplicate.
 */
export const JOBS = {
	invitations: {
		name: "Send invitations",
		runs: "Working days, 9am",
		run: sendInvitations,
	},
	booking_reminders: {
		name: "Send booking reminders",
		runs: "Weekly on the reminder day, 9am",
		run: sendBookingReminders,
	},
	rebook_reminders: {
		name: "Send rebook reminders",
		runs: "Weekly on the reminder day, 9am",
		run: sendRebookReminders,
	},
	session_reminders: {
		name: "Send session reminders",
		runs: "Working days, 9am",
		run: sendSessionReminders,
	},
	return_reminders: {
		name: "Send return reminders",
		runs: "Weekly on the return reminder day, 9am",
		run: sendReturnReminders,
	},
	purge_connection_log: {
		name: "Purge connection log",
		runs: "Daily, 9am",
		run: async (context) => {
			const row = await queryOne<{ n: number }>("SELECT lr.purge_connection_log() AS n");
			context.note(`${row?.n ?? 0} entries older than 7 days deleted`);
		},
	},
	purge_email_counts: {
		name: "Purge email counts",
		runs: "Daily, 9am",
		run: async (context) => {
			const row = await queryOne<{ n: number }>("SELECT lr.purge_email_sends() AS n");
			context.note(`${row?.n ?? 0} emails older than 13 months deleted`);
		},
	},
} as const satisfies Record<string, JobDefinition>;

export type JobKey = keyof typeof JOBS;

export const JOB_KEYS = Object.keys(JOBS) as JobKey[];

export function isJobKey(value: string): value is JobKey {
	return value in JOBS;
}

export type JobResult = JobRunSummary & { job: JobKey; name: string };

/** Runs one job, or all of them together as the 9am timer does. */
export async function runJobs(keys: readonly JobKey[], start: JobStart): Promise<JobResult[]> {
	const environment = await loadEnvironment();
	const results: JobResult[] = [];
	for (const key of keys) {
		const job: JobDefinition = JOBS[key];
		try {
			const summary = await runLogged(key, job.name, start, (context) =>
				job.run(context, environment),
			);
			results.push({ job: key, name: job.name, ...summary });
		} catch (error) {
			// Only when the run could not start, such as one already running.
			results.push({
				job: key,
				name: job.name,
				runId: 0,
				processed: 0,
				failed: 0,
				note: null,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	return results;
}

async function loadEnvironment(): Promise<JobEnvironment> {
	const [settings, holidays] = await Promise.all([
		queryOne<JobSettings>(
			`SELECT invitations_per_working_day, first_reminder_after_days, reminder_weekday,
			        flag_after_reminders, software_lock_working_days, return_reminders_enabled,
			        return_reminder_weekday
			 FROM lr.settings WHERE id = 1`,
		),
		getBankHolidaysClient().englandAndWales(),
	]);
	if (!settings) throw new Error("The laptop replacement settings are missing");
	return { settings, holidays };
}

/** Emails one case for a job and logs it; true when it sent. */
async function emailCase(
	context: JobContext,
	key: Parameters<typeof sendCaseEmail>[0]["key"],
	caseId: string,
	bookingId?: string,
): Promise<boolean> {
	const sent = await sendCaseEmail({
		key,
		caseId,
		bookingId,
		trigger: context.trigger,
		actor: context.actor,
		scheduled: true,
	});
	await context.logCase({
		caseId,
		bookingId,
		outcome: sent.ok ? "sent" : "failed",
		detail: sent.ok ? undefined : sent.message,
	});
	return sent.ok;
}

/**
 * Up to the daily limit of the oldest Queued cases get the invitation and
 * move to Pending. Working days only. The email goes first: if it fails the
 * case stays Queued and is tried again next time.
 */
async function sendInvitations(context: JobContext, { settings, holidays }: JobEnvironment) {
	if (!isWorkingDay(context.day, holidays)) return context.note("Not a working day");
	const done = await queryOne<{ n: number }>(
		`SELECT count(*)::integer AS n FROM lr.job_run_cases jc JOIN lr.job_runs r ON r.id = jc.job_run_id
		 WHERE r.job = 'invitations' AND r.run_date = $1 AND jc.outcome = 'sent'`,
		[context.day],
	);
	const remaining = settings.invitations_per_working_day - (done?.n ?? 0);
	if (remaining <= 0) return context.note("Today's invitations have already gone");

	const cases = await query<{ id: string }>(
		"SELECT id FROM lr.cases WHERE status = 'queued' ORDER BY queued_at, id LIMIT $1",
		[remaining],
	);
	if (!cases.length) return context.note("Nobody in the invitation queue");
	for (const { id } of cases) {
		if (!(await emailCase(context, "invitation", id))) continue;
		await withTransaction(async (tx) => {
			const moved = await query(
				`UPDATE lr.cases SET status = 'pending', invited_at = now(), reminders_sent = 0
				 WHERE id = $1 AND status = 'queued' RETURNING id`,
				[id],
				tx,
			);
			if (!moved.length) return;
			await addJournalEntry(tx, {
				caseId: id,
				actor: context.actor,
				kind: "status",
				body: "Invited: Queued to Pending",
			});
		});
	}
}

/**
 * Pending and Unbooked cases (reminders not paused) get a weekly reminder
 * from the first reminder day at least `first_reminder_after_days` after the
 * invitation. The same rules as lr.email_forecast.
 */
async function sendBookingReminders(context: JobContext, environment: JobEnvironment) {
	const { settings, holidays } = environment;
	if (!isWeeklySendDay(context.day, settings.reminder_weekday, holidays)) {
		return context.note("Not the reminder day");
	}
	const cases = await query<{ id: string }>(
		`SELECT c.id FROM lr.cases c
		 WHERE c.status IN ('pending', 'unbooked') AND NOT c.reminders_paused
		   AND c.invited_at IS NOT NULL
		   AND (c.invited_at AT TIME ZONE 'Europe/London')::date + $3::integer <= $2::date
		   AND ${notSentToday("c.id", 1, 2)}
		 ORDER BY c.invited_at, c.id`,
		["booking_reminders", context.day, settings.first_reminder_after_days],
	);
	if (!cases.length) return context.note("Nobody due a reminder");
	for (const { id } of cases) {
		if (await emailCase(context, "booking_reminder", id)) {
			await countReminder(context, id, environment.settings.flag_after_reminders);
		}
	}
}

/** Rebook required cases get a weekly reminder from 7 days after the rebook request. */
async function sendRebookReminders(context: JobContext, environment: JobEnvironment) {
	const { settings, holidays } = environment;
	if (!isWeeklySendDay(context.day, settings.reminder_weekday, holidays)) {
		return context.note("Not the reminder day");
	}
	const cases = await query<{ id: string }>(
		`SELECT c.id FROM lr.cases c
		 WHERE c.status = 'rebook_required'
		   AND (c.rebook_requested_at AT TIME ZONE 'Europe/London')::date + 7 <= $2::date
		   AND ${notSentToday("c.id", 1, 2)}
		 ORDER BY c.rebook_requested_at, c.id`,
		["rebook_reminders", context.day],
	);
	if (!cases.length) return context.note("Nobody due a reminder");
	for (const { id } of cases) {
		if (await emailCase(context, "rebook_needed", id)) {
			await countReminder(context, id, settings.flag_after_reminders);
		}
	}
}

/**
 * Counts a sent reminder and flags the case when it reaches the setting
 * (3 by default). Flagging never changes the status or pauses reminders,
 * and a case the team has already flagged keeps its flag.
 */
async function countReminder(context: JobContext, caseId: string, flagAfter: number) {
	await withTransaction(async (tx) => {
		const row = await queryOne<{ reminders_sent: number; flag_kind: string | null }>(
			`UPDATE lr.cases SET reminders_sent = reminders_sent + 1, last_reminder_at = now()
			 WHERE id = $1 RETURNING reminders_sent, flag_kind`,
			[caseId],
			tx,
		);
		if (!row || row.reminders_sent !== flagAfter || row.flag_kind) return;
		const reason = `${flagAfter} reminders`;
		await query(
			`UPDATE lr.cases SET flag_kind = 'reminders', flag_reason = $2, flagged_at = now()
			 WHERE id = $1`,
			[caseId, reason],
			tx,
		);
		await addJournalEntry(tx, {
			caseId,
			actor: context.actor,
			kind: "flag",
			body: `Flagged: ${reason} sent`,
		});
	});
}

/**
 * Booked bookings whose session is `software_lock_working_days` working
 * days away get the session reminder, once per booking. Working days only.
 */
async function sendSessionReminders(context: JobContext, { settings, holidays }: JobEnvironment) {
	if (!isWorkingDay(context.day, holidays)) return context.note("Not a working day");
	const sessionDay = addWorkingDays(context.day, settings.software_lock_working_days, holidays);
	const bookings = await query<{ id: string; case_id: string }>(
		`SELECT b.id, b.case_id FROM lr.bookings b
		 LEFT JOIN lr.sessions se ON se.id = b.session_id
		 WHERE b.status = 'booked'
		   AND (se.id IS NULL OR se.status <> 'cancelled')
		   AND (coalesce(se.starts_at, b.custom_starts_at) AT TIME ZONE 'Europe/London')::date = $1::date
		   AND NOT EXISTS (
		     SELECT 1 FROM lr.job_run_cases jc JOIN lr.job_runs r ON r.id = jc.job_run_id
		     WHERE jc.booking_id = b.id AND jc.outcome = 'sent' AND r.job = 'session_reminders'
		   )
		 ORDER BY coalesce(se.starts_at, b.custom_starts_at), b.id`,
		[sessionDay],
	);
	if (!bookings.length) return context.note("No sessions that need a reminder");
	for (const booking of bookings) {
		await emailCase(context, "session_reminder", booking.case_id, booking.id);
	}
}

/**
 * Awaiting return cases with return reminders on get a weekly reminder to
 * bring back the old laptop, unless they are turned off for everyone.
 */
async function sendReturnReminders(context: JobContext, { settings, holidays }: JobEnvironment) {
	if (!settings.return_reminders_enabled) return context.note("Turned off in Settings");
	if (!isWeeklySendDay(context.day, settings.return_reminder_weekday, holidays)) {
		return context.note("Not the return reminder day");
	}
	const cases = await query<{ id: string }>(
		`SELECT c.id FROM lr.cases c
		 WHERE c.status = 'awaiting_return' AND c.return_reminders
		   AND ${notSentToday("c.id", 1, 2)}
		 ORDER BY c.attended_at, c.id`,
		["return_reminders", context.day],
	);
	if (!cases.length) return context.note("Nobody due a return reminder");
	for (const { id } of cases) await emailCase(context, "return_reminder", id);
}
