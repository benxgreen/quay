import "server-only";

import { cookies, headers } from "next/headers";
import { entraFromEnv, getAuth } from "@/lib/auth/better-auth";
import { DEV_USER_COOKIE } from "@/lib/auth/constants";

/**
 * "entra" signs in with Microsoft Entra ID through Better Auth. "dev" is a
 * development sign-in that lets you choose any (mock) Halo user, until the
 * app registration exists. Dev is the default only outside production
 * when Entra is not configured, and is refused in production.
 */
export function authMode(): "entra" | "dev" {
	const mode = process.env.AUTH_MODE ?? (entraFromEnv() ? "entra" : "dev");
	if (mode === "dev" && process.env.NODE_ENV === "production") {
		throw new Error(
			"The development sign-in cannot be used in production. Set the ENTRA_* settings.",
		);
	}
	return mode === "dev" ? "dev" : "entra";
}

/** The signed-in person's Entra object ID, or null when nobody is signed in. */
export async function getSignedInObjectId(): Promise<string | null> {
	// Read the request first, so pages that ask are rendered per request
	// rather than at build time (where authMode would refuse dev mode).
	const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
	if (authMode() === "dev") {
		return cookieStore.get(DEV_USER_COOKIE)?.value || null;
	}
	const session = await getAuth().api.getSession({ headers: requestHeaders });
	return session?.user.entraObjectId ?? null;
}

/** Ends the session: after a failed sign-in, so "Try again" starts afresh. */
export async function endSession(): Promise<void> {
	if (authMode() === "dev") {
		(await cookies()).delete(DEV_USER_COOKIE);
		return;
	}
	await getAuth().api.signOut({ headers: await headers() });
}
