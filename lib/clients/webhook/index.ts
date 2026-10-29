import "server-only";

import { HttpStatusError } from "@/lib/clients/connection-log";

/**
 * Ported from Harbour (bcp-fms _lib/forms/submissions/webhook.ts) so the two
 * send webhooks the same way: validate the URL, POST JSON, retry twice with
 * backoff. The difference: Harbour fails silently after the last attempt,
 * but the portal's "external calls first" rule needs to know, so this
 * throws and the caller shows the Failed banner.
 */

/**
 * Private IP ranges that must never be targeted by outbound webhook requests.
 * Blocking these prevents SSRF attacks where an admin could configure a
 * webhook pointing at an internal service (e.g. cloud metadata, the database).
 */
const BLOCKED_CIDR_PREFIXES = [
	"127.",
	"10.",
	"0.",
	"169.254.", // Link-local / cloud metadata endpoint
	"[::1]", // IPv6 loopback
	"[fc", // IPv6 unique-local
	"[fd",
];

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

/**
 * Validates a webhook URL before use.
 * Throws if the URL is not HTTPS (in production), points to a private IP range,
 * or uses a disallowed hostname.
 */
export function validateWebhookUrl(url: string): void {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error("Invalid webhook URL");
	}

	if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
		throw new Error("Webhook URL must use HTTPS in production");
	}

	const host = parsed.hostname.toLowerCase();

	if (BLOCKED_HOSTNAMES.has(host)) {
		throw new Error(`Webhook URL targets a disallowed host: ${host}`);
	}

	for (const prefix of BLOCKED_CIDR_PREFIXES) {
		if (host.startsWith(prefix)) {
			throw new Error(`Webhook URL targets a private or reserved address: ${host}`);
		}
	}

	// Block 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
	const match = host.match(/^172\.(\d+)\./);
	if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) {
		throw new Error(`Webhook URL targets a private address: ${host}`);
	}

	// Block 192.168.x.x
	if (host.startsWith("192.168.")) {
		throw new Error(`Webhook URL targets a private address: ${host}`);
	}
}

type PostOptions = {
	/** Aborts every attempt, such as callExternal's timeout. */
	signal?: AbortSignal;
	fetchFn?: typeof fetch;
	/** Waits between attempts. Replaceable in tests. */
	sleep?: (ms: number) => Promise<void>;
};

/**
 * Validates the URL and POSTs a JSON payload, retrying twice with
 * exponential backoff (1s, 2s). Returns the HTTP status of the successful
 * attempt; throws HttpStatusError (or the network error) if every attempt
 * fails, and stops at once if the signal aborts.
 */
export async function postJsonWebhook(
	webhookUrl: string,
	payload: Record<string, unknown>,
	{ signal, fetchFn = fetch, sleep = defaultSleep }: PostOptions = {},
): Promise<number> {
	validateWebhookUrl(webhookUrl);

	const maxRetries = 2;
	const baseDelay = 1000; // 1 second
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetchFn(webhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
				signal,
			});

			if (!response.ok) {
				throw new HttpStatusError(
					response.status,
					`HTTP ${response.status}: ${response.statusText}`.trim(),
				);
			}

			return response.status;
		} catch (error) {
			lastError = error;
			console.error("ERROR [Webhook]  Delivery attempt failed", {
				attempt: attempt + 1,
				error: String(error),
			});

			if (signal?.aborted || attempt === maxRetries) {
				break;
			}

			// Exponential backoff: 1s, 2s
			await sleep(baseDelay * 2 ** attempt);
		}
	}

	throw lastError;
}

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
