import "server-only";

import {
	type CallContext,
	type CallResult,
	callExternal,
	HttpStatusError,
} from "@/lib/clients/connection-log";
import { clientMode, getConnectionUrl, mockShouldFail } from "@/lib/clients/connections";
import { createHaloHttp, type HaloHttp, haloCredentialsFromEnv } from "./http";

/**
 * HaloITSM, the asset register and staff directory. The portal has one Halo
 * connection, the Halo site in portal.connections (secrets in .env); each
 * part of the portal declares the Halo requests it needs on top of it:
 *
 *   lib/clients/halo/users.ts                      staff details (portal-wide)
 *   services/replacements/laptops/lib/halo         laptop replacements
 *
 * HALO_CLIENT=http uses the real API (lib/clients/halo/http.ts); anything
 * else uses the mocks.
 */
export const HALO_CONNECTION = "halo";

export function haloMode(): "mock" | "http" {
	return clientMode("HALO_CLIENT");
}

/**
 * One logged Halo call: signs in, runs the requests `work` makes and writes
 * one connection log entry, whose summary lists the requests, such as
 * "Staff details: found Priya Hart (GET /Users, GET /Users/1002)".
 */
export async function callHalo<T>(
	context: CallContext,
	work: (halo: HaloHttp) => Promise<{ value: T; summary?: string }>,
	{ fetchFn }: { fetchFn?: typeof fetch } = {},
): Promise<CallResult<T>> {
	const siteUrl = await getConnectionUrl(HALO_CONNECTION);
	return callExternal(HALO_CONNECTION, context, async (signal) => {
		const halo = createHaloHttp({
			siteUrl,
			credentials: haloCredentialsFromEnv(),
			signal,
			fetchFn,
		});
		const { value, summary } = await work(halo);
		const requests = summariseRequests(halo.requests);
		return {
			value,
			statusCode: halo.lastStatus,
			summary: summary ? `${summary} (${requests})` : requests,
		};
	});
}

/** "GET /Users, GET /Users/{id}", with repeats counted: "GET /Users ×64". */
export function summariseRequests(requests: readonly string[]): string {
	const counts = new Map<string, number>();
	for (const request of requests) {
		const shape = request.replace(/\/\d+(?=\/|$)/g, "/{id}");
		counts.set(shape, (counts.get(shape) ?? 0) + 1);
	}
	return [...counts]
		.map(([shape, count]) => (count > 1 ? `${shape} ×${count}` : shape))
		.join(", ");
}

/**
 * A mock Halo call, logged against the Halo connection like the real thing.
 * Fails with a 503 when MOCK_FAILURES lists "halo".
 */
export function mockHaloCall<T>(
	context: CallContext,
	produce: () => { value: T; summary?: string },
): Promise<CallResult<T>> {
	return callExternal(HALO_CONNECTION, context, async () => {
		if (mockShouldFail(HALO_CONNECTION)) {
			throw new HttpStatusError(503, "Halo returned 503 Service Unavailable");
		}
		const { value, summary } = produce();
		return { value, statusCode: 200, summary };
	});
}
