import "server-only";

import { HttpStatusError } from "@/lib/clients/connection-log";

/**
 * Requests to the Halo REST API (https://halohub.bcpcouncil.gov.uk/apidoc).
 *
 * - Sign-in is OAuth2 client credentials: POST {site}/auth/token with the
 *   client ID and secret from the environment. Tokens last an hour and are
 *   reused until a minute before they expire.
 * - Resources are under {site}/api. Halo reads with GET and creates or
 *   updates with POST (an array; a record with an `id` is updated). There
 *   is no PUT.
 * - Halo allows 700 requests in 5 minutes and answers 429 after that.
 *
 * One portal action can make several requests (a lookup, then the full
 * record, then an update); they share one connection log entry.
 */
export type HaloHttp = {
	get<T>(path: string, query?: HaloQuery): Promise<T>;
	post<T>(path: string, body: unknown): Promise<T>;
	/** The requests made so far, such as "GET /Users", for the connection log. */
	readonly requests: readonly string[];
	/** The status of the last response. */
	readonly lastStatus: number | undefined;
};

export type HaloQuery = Record<string, string | number | boolean | undefined>;

export type HaloCredentials = {
	clientId: string;
	clientSecret: string;
	/** Halo's application permissions. The docs suggest "all" if unsure. */
	scope: string;
};

type HaloHttpOptions = {
	/** The Halo site from portal.connections, such as https://halohub.bcpcouncil.gov.uk. */
	siteUrl: string;
	credentials: HaloCredentials;
	signal?: AbortSignal;
	fetchFn?: typeof fetch;
	now?: () => number;
};

type CachedToken = { accessToken: string; expiresAt: number };

const globalForHalo = globalThis as unknown as { quayHaloTokens?: Map<string, CachedToken> };
globalForHalo.quayHaloTokens ??= new Map();
const tokens = globalForHalo.quayHaloTokens;

const REFRESH_EARLY_MS = 60_000;

/** The credentials from the environment. Throws a clear message if they are missing. */
export function haloCredentialsFromEnv(): HaloCredentials {
	const clientId = process.env.HALO_CLIENT_ID;
	const clientSecret = process.env.HALO_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error("HALO_CLIENT_ID and HALO_CLIENT_SECRET are not set.");
	}
	return { clientId, clientSecret, scope: process.env.HALO_SCOPE || "all" };
}

/** Accepts the site with or without a trailing /api or slash. */
export function haloSite(url: string): string {
	return url.replace(/\/+$/, "").replace(/\/api$/i, "");
}

export function createHaloHttp({
	siteUrl,
	credentials,
	signal,
	fetchFn = fetch,
	now = Date.now,
}: HaloHttpOptions): HaloHttp {
	const site = haloSite(siteUrl);
	const cacheKey = `${site} ${credentials.clientId}`;
	const requests: string[] = [];
	let lastStatus: number | undefined;

	async function accessToken(): Promise<string> {
		const cached = tokens.get(cacheKey);
		if (cached && cached.expiresAt - REFRESH_EARLY_MS > now()) {
			return cached.accessToken;
		}

		const response = await fetchFn(`${site}/auth/token`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "client_credentials",
				client_id: credentials.clientId,
				client_secret: credentials.clientSecret,
				scope: credentials.scope,
			}),
			signal,
		});
		lastStatus = response.status;
		if (!response.ok) {
			throw new HttpStatusError(
				response.status,
				`Halo sign-in failed with ${response.status}`,
			);
		}
		const body = (await response.json()) as { access_token?: string; expires_in?: number };
		if (!body.access_token) {
			throw new Error("Halo sign-in returned no access token");
		}
		const token = {
			accessToken: body.access_token,
			expiresAt: now() + (body.expires_in ?? 3600) * 1000,
		};
		tokens.set(cacheKey, token);
		return token.accessToken;
	}

	async function request<T>(method: "GET" | "POST", path: string, init: RequestInit): Promise<T> {
		requests.push(`${method} ${path.split("?")[0]}`);
		const url = `${site}/api${path}`;

		const send = async () =>
			fetchFn(url, {
				...init,
				method,
				headers: {
					Accept: "application/json",
					...(init.body ? { "Content-Type": "application/json" } : {}),
					Authorization: `Bearer ${await accessToken()}`,
				},
				signal,
			});

		let response = await send();
		if (response.status === 401) {
			// The token may have been revoked or expired early: sign in again once.
			tokens.delete(cacheKey);
			response = await send();
		}
		lastStatus = response.status;

		if (!response.ok) {
			throw new HttpStatusError(response.status, describeStatus(response));
		}
		const text = await response.text();
		return (text ? JSON.parse(text) : undefined) as T;
	}

	return {
		get: (path, query) => request("GET", withQuery(path, query), {}),
		post: (path, body) => request("POST", path, { body: JSON.stringify(body) }),
		get requests() {
			return requests;
		},
		get lastStatus() {
			return lastStatus;
		},
	};
}

function withQuery(path: string, query: HaloQuery = {}): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined) params.set(key, String(value));
	}
	const search = params.toString();
	return search ? `${path}?${search}` : path;
}

function describeStatus(response: Response): string {
	if (response.status === 429) {
		return "Halo returned 429: too many requests (Halo allows 700 in 5 minutes). Try again shortly.";
	}
	return `Halo returned ${response.status} ${response.statusText}`.trim();
}

/** For tests: forget cached tokens. */
export function clearHaloTokens(): void {
	tokens.clear();
}
