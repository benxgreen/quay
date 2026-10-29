import "server-only";

import { queryOne } from "@/lib/db/query";

/** A connection has no URL yet: an Administrator needs to set it in Settings › Connections. */
export class ConnectionNotConfiguredError extends Error {
	constructor(readonly connection: string) {
		super(`The ${connection} connection has no URL. Set it in Settings › Connections.`);
		this.name = "ConnectionNotConfiguredError";
	}
}

/**
 * The URL for a connection, from portal.connections. Secrets are never stored
 * there; each client reads its own from the environment.
 */
export async function getConnectionUrl(key: string): Promise<string> {
	const row = await queryOne<{ url: string | null }>(
		"SELECT url FROM portal.connections WHERE key = $1",
		[key],
	);
	if (!row?.url) {
		throw new ConnectionNotConfiguredError(key);
	}
	return row.url;
}

/** Which implementation a client uses: the mock until the real details arrive. */
export function clientMode(envName: string): "mock" | "http" {
	return process.env[envName] === "http" ? "http" : "mock";
}

/**
 * Lets development see a Failed banner on demand: list connection names in
 * MOCK_FAILURES (comma-separated) and their mock calls fail with a 503.
 */
export function mockShouldFail(connection: string): boolean {
	return (process.env.MOCK_FAILURES ?? "")
		.split(",")
		.map((name) => name.trim())
		.includes(connection);
}
