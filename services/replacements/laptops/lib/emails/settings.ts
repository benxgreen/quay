import "server-only";

import { getBankHolidaysClient } from "@/lib/clients/bank-holidays";
import { addDays, type IsoDate, isWorkingDay } from "@/lib/dates/working-days";
import { query, queryOne } from "@/lib/db/query";
import type { EmailTemplate } from "@/lib/emails/render";
import { type EmailSender, type SendEmailResult, sendEmail } from "@/lib/emails/send";
import { portalUrl } from "@/lib/portal/url";
import {
	LAPTOP_EMAIL_VARIABLES,
	LAPTOP_EMAILS,
	type LaptopEmailKey,
} from "@/services/replacements/laptops/lib/emails";

/**
 * Settings › Emails (spec, "Emails" and "Emails each day"): each email's
 * wording, who it is sent from, test sends and how many go out each day.
 */

export function isLaptopEmailKey(value: string): value is LaptopEmailKey {
	return LAPTOP_EMAILS.some((email) => email.key === value);
}

export type { EmailSender };

export async function getEmailSender(): Promise<EmailSender> {
	const row = await queryOne<EmailSender>(
		`SELECT team_name AS "teamName", sent_from AS "sentFrom" FROM lr.settings WHERE id = 1`,
	);
	if (!row) throw new Error("The laptop replacement settings are missing");
	return row;
}

export async function saveEmailSender(changes: Partial<EmailSender>, actorId: string) {
	await query(
		`UPDATE lr.settings
		 SET team_name = coalesce($1, team_name), sent_from = coalesce($2, sent_from),
		     updated_by = $3, updated_at = now()
		 WHERE id = 1`,
		[changes.teamName ?? null, changes.sentFrom ?? null, actorId],
	);
}

export async function getEmailTemplate(key: LaptopEmailKey): Promise<EmailTemplate | undefined> {
	return queryOne<EmailTemplate>(
		`SELECT subject, preheader, body_markdown AS "bodyMarkdown"
		 FROM lr.email_templates WHERE key = $1`,
		[key],
	);
}

export async function saveEmailTemplate(
	key: LaptopEmailKey,
	template: EmailTemplate,
	actorId: string,
): Promise<void> {
	await query(
		`UPDATE lr.email_templates
		 SET subject = $2, preheader = $3, body_markdown = $4, updated_by = $5, updated_at = now()
		 WHERE key = $1`,
		[key, template.subject, template.preheader, template.bodyMarkdown, actorId],
	);
}

/**
 * The example details shown in the preview and used in a test: the
 * variables' examples, with a real link and the team name from Settings.
 */
export function exampleValues(teamName: string): Record<string, string> {
	return {
		...Object.fromEntries(
			LAPTOP_EMAIL_VARIABLES.map((variable) => [variable.name, variable.example]),
		),
		booking_link: portalUrl("/my/replacements/laptop"),
		software_list: "- Adobe Acrobat Pro\n- Power BI",
		team_name: teamName,
	};
}

/**
 * Sends the email as written (saved or not) to the person testing it, with
 * the example details. Any variable without a value is sent as written, so
 * mistakes show. Logged as an email_webhook call; not counted or journaled,
 * because it isn't about a case.
 */
export async function sendTestEmail(
	key: LaptopEmailKey,
	template: EmailTemplate,
	to: string,
	actorId: string,
): Promise<SendEmailResult> {
	const sender = await getEmailSender();
	return sendEmail({
		key,
		service: "laptop_replacements",
		caseReference: null,
		to,
		sender,
		template,
		values: exampleValues(sender.teamName),
		mode: "test",
		context: { trigger: { kind: "user", label: "Test email", actorUserId: actorId } },
		subjectPrefix: "[Test] ",
	});
}

// Emails each day ----------------------------------------------------------

export type ForecastDay = {
	day: IsoDate;
	invitations: number;
	bookingReminders: number;
	rebookReminders: number;
	sessionReminders: number;
	returnReminders: number;
	total: number;
};

export type SentDay = {
	day: IsoDate;
	invitations: number;
	reminders: number;
	automatic: number;
	failed: number;
	totalSent: number;
};

export type EmailsEachDay = {
	today: SentDay;
	/** The next 5 working days after today, from lr.email_forecast. */
	forecast: ForecastDay[];
	/** Today and the 4 working days before it, newest first. */
	sent: SentDay[];
	queued: number;
	perDay: number;
};

function emptyDay(day: IsoDate): SentDay {
	return { day, invitations: 0, reminders: 0, automatic: 0, failed: 0, totalSent: 0 };
}

export async function emailsEachDay(today: IsoDate): Promise<EmailsEachDay> {
	let holidays: IsoDate[] = [];
	try {
		holidays = await getBankHolidaysClient().englandAndWales();
	} catch {
		// Without the feed the forecast treats bank holidays as working days.
	}
	const past: IsoDate[] = [today];
	for (let day = addDays(today, -1); past.length < 5; day = addDays(day, -1)) {
		if (isWorkingDay(day, holidays)) past.push(day);
	}

	const [forecast, sent, queue] = await Promise.all([
		query<ForecastDay>(
			`SELECT to_char(day, 'YYYY-MM-DD') AS day, invitations,
			        booking_reminders AS "bookingReminders", rebook_reminders AS "rebookReminders",
			        session_reminders AS "sessionReminders", return_reminders AS "returnReminders", total
			 FROM lr.email_forecast($1::date, 5, $2::date[])`,
			[addDays(today, 1), holidays],
		),
		query<SentDay>(
			`SELECT to_char(day, 'YYYY-MM-DD') AS day, invitations::integer, reminders::integer,
			        automatic::integer, failed::integer, total_sent::integer AS "totalSent"
			 FROM lr.emails_per_day WHERE day = ANY ($1::date[])`,
			[past],
		),
		queryOne<{ queued: number; perDay: number }>(
			`SELECT (SELECT count(*)::integer FROM lr.cases WHERE status = 'queued') AS queued,
			        invitations_per_working_day AS "perDay"
			 FROM lr.settings WHERE id = 1`,
		),
	]);
	const byDay = new Map(sent.map((row) => [row.day, row]));
	const days = past.map((day) => byDay.get(day) ?? emptyDay(day));
	return {
		today: days[0],
		forecast,
		sent: days,
		queued: queue?.queued ?? 0,
		perDay: queue?.perDay ?? 0,
	};
}
