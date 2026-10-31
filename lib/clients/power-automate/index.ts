import "server-only";

import { randomUUID } from "node:crypto";
import type { CallContext, CallResult } from "@/lib/clients/connection-log";
import { callExternal, HttpStatusError } from "@/lib/clients/connection-log";
import { clientMode, getConnectionUrl, mockShouldFail } from "@/lib/clients/connections";
import { postJsonWebhook } from "@/lib/clients/webhook";
import { portalUrl } from "@/lib/portal/url";

/**
 * The portal's one way of telling Power Automate something happened. Every
 * post has the same envelope, carrying as much as the portal knows, and the
 * flow decides what to do with it: the portal holds no flow logic, and a
 * flow can start using a field without a portal change. Emails are one kind
 * of event (type "email", with the rendered content in `email`); the
 * notification library will add others, such as "booking.rebooked".
 *
 * Bump SCHEMA_VERSION if a field is renamed or removed, so flows can tell.
 */
export const SCHEMA_VERSION = 1;

/** An email, rendered by the portal, for the flow to send as it is. */
export type WebhookEmail = {
	/** The email's key, such as "session_cancelled". */
	template: string;
	to: string;
	from_name: string;
	from: string;
	subject: string;
	preheader: string;
	html: string;
	text: string;
};

/** What the caller says happened. */
export type WebhookEvent = {
	/** Such as "email", "booking.rebooked" or "case.withdrawn". */
	type: string;
	/** Such as "laptop_replacements"; left out for portal-wide events. */
	service?: string;
	/** The case it's about, such as LR-000160, with its page for the team. */
	case?: { reference: string; url?: string } | null;
	/** The person it's about, such as the colleague who rebooked. */
	person?: { name: string; email: string } | null;
	/** The rendered email, for type "email". */
	email?: WebhookEmail;
	/** Anything else the portal knows: an email's variables, the old and new booking… */
	data?: Record<string, unknown>;
};

/** What is posted: the event in the shared envelope. */
export type WebhookPayload = WebhookEvent & {
	schema_version: number;
	/** Unique per post, so a flow can ignore a repeat. */
	id: string;
	/** When the portal posted it, ISO 8601 in UTC. */
	sent_at: string;
	/** NODE_ENV, or PORTAL_ENVIRONMENT (such as "test") where set. */
	environment: string;
	portal_url: string;
	/** What started it: a person, the 9am jobs or the portal itself. */
	triggered_by: { kind: string; label: string; user_id: string | null };
};

export type PowerAutomateClient = {
	/** Posts one event to the webhook in portal.connections under `connection`. */
	post(connection: string, event: WebhookEvent, context: CallContext): Promise<CallResult<void>>;
};

// Three attempts with backoff fit inside this.
const TIMEOUT_MS = 30_000;

/** Wraps an event in the envelope. Exported for tests and previews. */
export function toWebhookPayload(event: WebhookEvent, context: CallContext): WebhookPayload {
	return {
		schema_version: SCHEMA_VERSION,
		id: randomUUID(),
		sent_at: new Date().toISOString(),
		environment: process.env.PORTAL_ENVIRONMENT || process.env.NODE_ENV || "development",
		portal_url: portalUrl(),
		triggered_by: {
			kind: context.trigger.kind,
			label: context.trigger.label,
			user_id: context.trigger.actorUserId ?? null,
		},
		...event,
		service: event.service ?? context.service,
	};
}

function summarise(payload: WebhookPayload): string {
	if (payload.email) return `${payload.email.template} to ${payload.email.to}`;
	return payload.case ? `${payload.type} for ${payload.case.reference}` : payload.type;
}

/** Posts to the webhook URL in portal.connections (Settings › Connections). */
export function createHttpPowerAutomateClient(fetchFn: typeof fetch = fetch): PowerAutomateClient {
	return {
		async post(connection, event, context) {
			const url = await getConnectionUrl(connection);
			const payload = toWebhookPayload(event, context);
			return callExternal(
				connection,
				context,
				async (signal) => {
					const status = await postJsonWebhook(url, payload, { signal, fetchFn });
					return { value: undefined, statusCode: status, summary: summarise(payload) };
				},
				{ timeoutMs: TIMEOUT_MS },
			);
		},
	};
}

export type MockWebhookPost = { connection: string; payload: WebhookPayload };

const globalForPosts = globalThis as unknown as { quayMockWebhookPosts?: MockWebhookPost[] };

/** What the mock client has "posted" since the server started, newest last. */
export function mockWebhookPosts(): MockWebhookPost[] {
	globalForPosts.quayMockWebhookPosts ??= [];
	return globalForPosts.quayMockWebhookPosts;
}

/**
 * Keeps posts in memory instead of sending them, logged like the real
 * thing. List the connection in MOCK_FAILURES to see a failure.
 */
export function createMockPowerAutomateClient(): PowerAutomateClient {
	return {
		post(connection, event, context) {
			return callExternal(connection, context, async () => {
				if (mockShouldFail(connection)) {
					throw new HttpStatusError(502, "Power Automate returned 502 Bad Gateway");
				}
				const payload = toWebhookPayload(event, context);
				mockWebhookPosts().push({ connection, payload });
				return { value: undefined, statusCode: 202, summary: summarise(payload) };
			});
		},
	};
}

let client: PowerAutomateClient | undefined;

/** The Power Automate client: the mock unless WEBHOOK_CLIENT (or EMAIL_CLIENT) is http. */
export function getPowerAutomateClient(): PowerAutomateClient {
	client ??=
		clientMode(process.env.WEBHOOK_CLIENT ? "WEBHOOK_CLIENT" : "EMAIL_CLIENT") === "http"
			? createHttpPowerAutomateClient()
			: createMockPowerAutomateClient();
	return client;
}
