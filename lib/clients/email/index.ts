import "server-only";

import type { CallContext, CallResult } from "@/lib/clients/connection-log";
import { callExternal, HttpStatusError } from "@/lib/clients/connection-log";
import { clientMode, getConnectionUrl, mockShouldFail } from "@/lib/clients/connections";
import { postJsonWebhook } from "@/lib/clients/webhook";

/**
 * One email, rendered by the portal and posted to the Power Automate flow,
 * which only sends it. Field names are the flow's JSON schema.
 */
export type EmailMessage = {
	/** The email's key, such as "session_cancelled". */
	template: string;
	/** Such as "laptop_replacements". */
	service: string;
	/** The case reference, such as "LR-000160", or null for a test email. */
	case: string | null;
	to: string;
	from_name: string;
	from: string;
	subject: string;
	preheader: string;
	html: string;
	text: string;
};

export type EmailClient = {
	/** Posts one email to the Power Automate webhook. Connection: email_webhook. */
	send(message: EmailMessage, context: CallContext): Promise<CallResult<void>>;
};

const CONNECTION = "email_webhook";
// Three attempts with backoff fit inside this.
const TIMEOUT_MS = 30_000;

/** Posts to the webhook URL in portal.connections (Settings › Connections). */
export function createPowerAutomateEmailClient(fetchFn: typeof fetch = fetch): EmailClient {
	return {
		async send(message, context) {
			const url = await getConnectionUrl(CONNECTION);
			return callExternal(
				CONNECTION,
				context,
				async (signal) => {
					const status = await postJsonWebhook(url, message, { signal, fetchFn });
					return {
						value: undefined,
						statusCode: status,
						summary: `${message.template} to ${message.to}`,
					};
				},
				{ timeoutMs: TIMEOUT_MS },
			);
		},
	};
}

const globalForOutbox = globalThis as unknown as { quayMockOutbox?: EmailMessage[] };

/** Emails the mock client has "sent" since the server started, newest last. */
export function mockOutbox(): EmailMessage[] {
	globalForOutbox.quayMockOutbox ??= [];
	return globalForOutbox.quayMockOutbox;
}

/**
 * Keeps emails in memory instead of sending them, logged like the real
 * thing. Set MOCK_FAILURES=email_webhook to see a failure.
 */
export function createMockEmailClient(): EmailClient {
	return {
		send(message, context) {
			return callExternal(CONNECTION, context, async () => {
				if (mockShouldFail(CONNECTION)) {
					throw new HttpStatusError(502, "Power Automate returned 502 Bad Gateway");
				}
				mockOutbox().push(message);
				return {
					value: undefined,
					statusCode: 202,
					summary: `${message.template} to ${message.to}`,
				};
			});
		},
	};
}

let client: EmailClient | undefined;

/** The email client: the mock unless EMAIL_CLIENT=http. */
export function getEmailClient(): EmailClient {
	client ??=
		clientMode("EMAIL_CLIENT") === "http"
			? createPowerAutomateEmailClient()
			: createMockEmailClient();
	return client;
}
