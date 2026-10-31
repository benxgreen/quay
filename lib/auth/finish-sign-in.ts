import "server-only";

import { newReference } from "@/lib/auth/reference";
import { endSession } from "@/lib/auth/session";
import { signInPortalUser } from "@/lib/auth/sign-in";
import type { HaloUsersClient } from "@/lib/clients/halo/users";

/**
 * The last step of signing in, for Microsoft's return (/auth/complete) and
 * the development sign-in: pairs the Entra object ID with the person's Halo
 * user and creates or refreshes their portal user. Returns where to go next:
 * where they were heading, or their home page. If they are not in Halo,
 * their account is disabled or Halo cannot be reached, the session is ended
 * and they go to "We could not sign you in" with a reference that is also
 * in the server log. The development sign-in passes the mock Halo users,
 * as its people only exist there.
 */
export async function finishSignIn(
	objectId: string,
	returnTo: string | null,
	users?: HaloUsersClient,
): Promise<string> {
	try {
		const result = await signInPortalUser(objectId, users);
		if (result.ok) {
			return returnTo ?? (result.roles.length > 0 ? "/manage" : "/my");
		}
		return await refuse({ reason: result.reason, detail: result.detail, objectId });
	} catch (error) {
		return await refuse({ reason: "error", detail: String(error), objectId });
	}
}

async function refuse(details: { reason: string; detail?: string; objectId: string }) {
	const reference = newReference();
	console.error("Sign-in refused", { reference, ...details });
	await endSession().catch(() => {});
	return `/sign-in/error?ref=${reference}`;
}
