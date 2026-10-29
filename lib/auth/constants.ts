/** Holds the Entra object ID of the person signed in with the development sign-in. */
export const DEV_USER_COOKIE = "quay_dev_user";

/** Set by proxy.ts so server components know the requested path, for returnTo. */
export const PATH_HEADER = "x-quay-path";

/**
 * Where to go after signing in: only a path within the portal, never
 * another site (`//evil.example` or `https://…`).
 */
export function safeReturnTo(value: string | null | undefined): string | null {
	if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
	return value;
}
