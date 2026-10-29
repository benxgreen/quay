import "server-only";

import {
	type CallContext,
	type CallResult,
	callExternal,
	HttpStatusError,
} from "@/lib/clients/connection-log";
import { clientMode, mockShouldFail } from "@/lib/clients/connections";

/**
 * HaloITSM, the asset register and staff directory. The portal has one Halo
 * connection, the API base URL in portal.connections; each part of the
 * portal declares the Halo calls it needs on top of it:
 *
 *   lib/clients/halo/users.ts                      staff details (portal-wide)
 *   services/replacements/laptops/lib/halo         laptop replacements
 *
 * OPEN QUESTIONS (CLAUDE.md): the reports, stock criteria, API details and
 * the decommission call are still to come from Ben, so only mocks exist.
 */
export const HALO_CONNECTION = "halo";

/** HALO_CLIENT=http is refused until the real API details arrive. */
export function assertHaloMock(): void {
	if (clientMode("HALO_CLIENT") === "http") {
		throw new Error(
			"The real Halo client is not built yet: the API details are an open question.",
		);
	}
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
