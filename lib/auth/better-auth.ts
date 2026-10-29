import "server-only";

import { betterAuth } from "better-auth";
import { getAccountCookie } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";
import { customSession } from "better-auth/plugins";

export type EntraSettings = {
	clientId: string;
	clientSecret: string;
	/** The council's tenant, so only BCP Council accounts can sign in. */
	tenantId: string;
};

type CreateAuthOptions = {
	secret: string;
	baseURL: string;
	entra: EntraSettings | null;
};

/**
 * Better Auth, used only for Entra ID single sign-on. There is no database:
 * the session lives in an encrypted cookie (stateless mode), and
 * portal.users is the only user table. Better Auth keeps the Entra account
 * (whose ID is the `oid` claim) in its encrypted account cookie; the
 * customSession plugin adds it to the session as `entraObjectId`, which the
 * portal pairs with the Halo user (lib/auth/sign-in.ts). Roles and details
 * are read from the database on every request, so a role change applies
 * straight away.
 *
 * Not `user.additionalFields`: stateless mode drops them from the cookie,
 * and Better Auth's account list is held in memory, so it is empty after a
 * restart or on another App Service instance (tests/lib/better-auth.test.ts).
 *
 * Profile photos and Microsoft Graph scopes are switched off: the portal
 * does not use Graph, and a photo would bloat the cookie.
 */
export function createAuth({ secret, baseURL, entra }: CreateAuthOptions) {
	return betterAuth({
		secret,
		baseURL,
		socialProviders: entra
			? {
					microsoft: {
						clientId: entra.clientId,
						clientSecret: entra.clientSecret,
						tenantId: entra.tenantId,
						prompt: "select_account",
						disableProfilePhoto: true,
						disableDefaultScope: true,
						scope: ["openid", "profile", "email"],
					},
				}
			: {},
		plugins: [
			customSession(async ({ user, session }, ctx) => {
				const account = await getAccountCookie(ctx);
				const entraObjectId =
					account?.providerId === "microsoft" ? String(account.accountId) : null;
				return { user: { ...user, entraObjectId }, session };
			}),
			nextCookies(),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;

/** Entra settings from the environment, or null until the app registration exists. */
export function entraFromEnv(): EntraSettings | null {
	const clientId = process.env.ENTRA_CLIENT_ID;
	const clientSecret = process.env.ENTRA_CLIENT_SECRET;
	const tenantId = process.env.ENTRA_TENANT_ID;
	return clientId && clientSecret && tenantId ? { clientId, clientSecret, tenantId } : null;
}

const globalForAuth = globalThis as unknown as { quayAuth?: Auth };

/** The app's Better Auth instance (BETTER_AUTH_SECRET, BETTER_AUTH_URL and ENTRA_* in .env). */
export function getAuth(): Auth {
	globalForAuth.quayAuth ??= createAuth({
		secret: process.env.BETTER_AUTH_SECRET ?? "",
		baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
		entra: entraFromEnv(),
	});
	return globalForAuth.quayAuth;
}
