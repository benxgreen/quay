import "server-only";

import type { CallContext, CallResult } from "@/lib/clients/connection-log";
import {
	createHttpPowerAutomateClient,
	createMockPowerAutomateClient,
	getPowerAutomateClient,
	mockWebhookPosts,
	type PowerAutomateClient,
	type WebhookEmail,
} from "@/lib/clients/power-automate";

/**
 * One email, rendered by the portal and posted to the Power Automate flow,
 * which only sends it. It goes as an "email" event in the shared webhook
 * envelope (lib/clients/power-automate), with everything else the portal
 * knows in `data`.
 */
export type EmailMessage = WebhookEmail & {
	/** Such as "laptop_replacements". */
	service: string;
	/** The case reference, such as "LR-000160", or null for a test email. */
	case: string | null;
	/** The variables it was filled with, and anything else worth passing on. */
	data?: Record<string, unknown>;
};

export type EmailClient = {
	/** Posts one email to the Power Automate webhook. Connection: email_webhook. */
	send(message: EmailMessage, context: CallContext): Promise<CallResult<void>>;
};

const CONNECTION = "email_webhook";

function emailClient(powerAutomate: () => PowerAutomateClient): EmailClient {
	return {
		send({ service, case: reference, data, ...email }, context) {
			return powerAutomate().post(
				CONNECTION,
				{
					type: "email",
					service,
					case: reference ? { reference } : null,
					email,
					data,
				},
				context,
			);
		},
	};
}

/** Posts to the webhook URL in portal.connections (Settings › Connections). */
export function createPowerAutomateEmailClient(fetchFn: typeof fetch = fetch): EmailClient {
	const powerAutomate = createHttpPowerAutomateClient(fetchFn);
	return emailClient(() => powerAutomate);
}

/** Emails the mock client has "sent" since the server started, newest last. */
export function mockOutbox(): WebhookEmail[] {
	return mockWebhookPosts().flatMap(({ connection, payload }) =>
		connection === CONNECTION && payload.email ? [payload.email] : [],
	);
}

/**
 * Keeps emails in memory instead of sending them, logged like the real
 * thing. Set MOCK_FAILURES=email_webhook to see a failure.
 */
export function createMockEmailClient(): EmailClient {
	const powerAutomate = createMockPowerAutomateClient();
	return emailClient(() => powerAutomate);
}

let client: EmailClient | undefined;

/** The email client: the shared Power Automate client, the mock unless EMAIL_CLIENT=http. */
export function getEmailClient(): EmailClient {
	client ??= emailClient(getPowerAutomateClient);
	return client;
}
