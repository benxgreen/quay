import "server-only";

import type { CallContext } from "@/lib/clients/connection-log";
import { ExternalCallError } from "@/lib/clients/connection-log";
import { ConnectionNotConfiguredError } from "@/lib/clients/connections";
import { getEmailClient } from "@/lib/clients/email";
import { type EmailTemplate, type EmailVariableValues, renderEmail } from "@/lib/emails/render";
import { getPortalEmailTemplate } from "@/lib/portal/email-template";

export type SendEmailResult =
	| { ok: true; connectionLogId?: number }
	| { ok: false; message: string; connectionLogId?: number };

/** Who an email is from: each service's team name and mailbox (in its settings). */
export type EmailSender = { teamName: string; sentFrom: string };

type SendEmailOptions = {
	/** The email's key, such as "session_cancelled". */
	key: string;
	/** Such as "laptop_replacements". */
	service: string;
	/** The case reference, or null for a test. */
	caseReference: string | null;
	to: string;
	sender: EmailSender;
	template: EmailTemplate;
	values: EmailVariableValues;
	mode: "send" | "test";
	context: CallContext;
	/** Put before the subject, such as "[Test] ". */
	subjectPrefix?: string;
};

/**
 * Renders any service's email in the portal email template and posts it to
 * Power Automate (logged as email_webhook). A failed call is returned, not
 * thrown, so the service can record it; anything else is a bug and throws.
 * What a service records about the send (counts, journal) is up to it.
 */
export async function sendEmail({
	key,
	service,
	caseReference,
	to,
	sender,
	template,
	values,
	mode,
	context,
	subjectPrefix = "",
}: SendEmailOptions): Promise<SendEmailResult> {
	const layout = await getPortalEmailTemplate();
	const rendered = renderEmail({
		template,
		layoutHtml: layout.html,
		teamName: sender.teamName,
		values,
		mode,
	});
	try {
		const sent = await getEmailClient().send(
			{
				template: key,
				service,
				case: caseReference,
				to,
				from_name: sender.teamName,
				from: sender.sentFrom,
				...rendered,
				subject: `${subjectPrefix}${rendered.subject}`,
			},
			context,
		);
		return { ok: true, connectionLogId: sent.logId };
	} catch (error) {
		if (error instanceof ExternalCallError || error instanceof ConnectionNotConfiguredError) {
			return {
				ok: false,
				message: error.message,
				connectionLogId: error instanceof ExternalCallError ? error.logId : undefined,
			};
		}
		throw error;
	}
}
