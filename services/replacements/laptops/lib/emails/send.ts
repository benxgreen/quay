import "server-only";

import type { CallTrigger } from "@/lib/clients/connection-log";
import { query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import { type SendEmailResult, sendEmail } from "@/lib/emails/send";
import { bookingLink } from "@/services/replacements/laptops/lib/booking-link";
import {
	type LaptopEmailCase,
	type LaptopEmailKey,
	laptopEmailValues,
} from "@/services/replacements/laptops/lib/emails";
import { addJournalEntry, type JournalActor } from "@/services/replacements/laptops/lib/journal";

export type { SendEmailResult } from "@/lib/emails/send";

type SendCaseEmailOptions = {
	key: LaptopEmailKey;
	caseId: string | number;
	/** The booking the email is about, if not the case's current one (such as a cancelled session). */
	bookingId?: string | number;
	trigger: CallTrigger;
	actor: JournalActor;
	/** True when a 9am job sends it (counted on Emails each day). */
	scheduled?: boolean;
};

/**
 * Sends one laptop replacement email for a case: renders it from its
 * template, posts it to Power Automate (logged as email_webhook), and then,
 * whether it sent or not, records it in lr.email_sends and the case's
 * journal (spec, "Notifications"). A failed email is journaled with a Failed
 * tag and returned, so the page can say who was not emailed.
 */
export async function sendCaseEmail({
	key,
	caseId,
	bookingId,
	trigger,
	actor,
	scheduled = false,
}: SendCaseEmailOptions): Promise<SendEmailResult> {
	const [emailCase, template, settings] = await Promise.all([
		loadEmailCase(caseId, bookingId),
		queryOne<{ subject: string; preheader: string; body_markdown: string }>(
			"SELECT subject, preheader, body_markdown FROM lr.email_templates WHERE key = $1",
			[key],
		),
		queryOne<{ team_name: string; sent_from: string }>(
			"SELECT team_name, sent_from FROM lr.settings WHERE id = 1",
		),
	]);
	if (!template || !settings) {
		throw new Error(`The ${key} email or the laptop settings are missing`);
	}

	const result = await sendEmail({
		key,
		service: "laptop_replacements",
		caseReference: emailCase.values.caseReference,
		to: emailCase.email,
		sender: { teamName: settings.team_name, sentFrom: settings.sent_from },
		template: {
			subject: template.subject,
			preheader: template.preheader,
			bodyMarkdown: template.body_markdown,
		},
		values: laptopEmailValues(emailCase.values, settings.team_name),
		mode: "send",
		context: { trigger, caseId },
	});
	const { connectionLogId } = result;

	const words = key.replaceAll("_", " ");
	await withTransaction(async (tx) => {
		await query(
			`INSERT INTO lr.email_sends (email_key, case_id, to_address, scheduled, outcome, connection_log_id)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				key,
				caseId,
				emailCase.email,
				scheduled,
				result.ok ? "sent" : "failed",
				connectionLogId ?? null,
			],
			tx,
		);
		await addJournalEntry(tx, {
			caseId,
			actor,
			kind: "email",
			body: result.ok ? `Email sent: ${words} to user` : `Email not sent: ${words} to user`,
			data: {
				email: key,
				to: emailCase.email,
				result: result.ok ? "sent" : "failed",
				...(result.ok
					? {}
					: { error: result.message, connection_log_id: connectionLogId ?? null }),
			},
			outcome: result.ok ? "success" : "failed",
		});
	});

	return result;
}

/** The person, booking and old device an email is about. */
async function loadEmailCase(
	caseId: string | number,
	bookingId?: string | number,
): Promise<{ email: string; values: LaptopEmailCase }> {
	const row = await queryOne<{
		reference: string;
		session_type: "collection" | "session";
		old_serial: string | null;
		display_name: string;
		email: string;
		day: string | null;
		time: string | null;
		location: string | null;
		software: string[] | null;
	}>(
		`SELECT c.reference, c.session_type, c.old_serial, u.display_name, u.email,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE 'Europe/London', 'YYYY-MM-DD') AS day,
		        to_char(coalesce(s.starts_at, b.custom_starts_at) AT TIME ZONE 'Europe/London', 'HH24:MI') AS time,
		        coalesce(s.location, b.custom_location) AS location,
		        b.software_requested AS software
		 FROM lr.cases c
		 JOIN portal.users u ON u.id = c.user_id
		 LEFT JOIN lr.bookings b ON b.id = coalesce(
		   $2::bigint,
		   (SELECT id FROM lr.bookings WHERE case_id = c.id AND status = 'booked'))
		 LEFT JOIN lr.sessions s ON s.id = b.session_id
		 WHERE c.id = $1`,
		[caseId, bookingId ?? null],
	);
	if (!row) throw new Error(`Case ${caseId} not found`);

	return {
		email: row.email,
		values: {
			firstName: row.display_name.split(" ")[0],
			fullName: row.display_name,
			caseReference: row.reference,
			type: row.session_type,
			booking:
				row.day && row.time
					? { date: row.day, startTime: row.time, location: row.location }
					: null,
			bookingLink: bookingLink(caseId),
			oldSerial: row.old_serial,
			software: [...(row.software ?? [])].sort((a, b) => a.localeCompare(b)),
		},
	};
}
