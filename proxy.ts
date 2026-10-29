import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { DEV_USER_COOKIE, PATH_HEADER } from "@/lib/auth/constants";

const SIGNED_IN_ONLY = ["/my", "/manage"];

/**
 * A quick check before the page renders: anyone without a session cookie is
 * sent to sign in and brought back afterwards. It only looks for the
 * cookie; layouts and server actions check the session and roles properly
 * (lib/auth/guards.ts). Also passes the path on for those checks.
 */
export function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;
	const protectedPath = SIGNED_IN_ONLY.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);

	if (protectedPath && !getSessionCookie(request) && !request.cookies.has(DEV_USER_COOKIE)) {
		const signIn = new URL("/sign-in", request.url);
		signIn.searchParams.set("returnTo", `${pathname}${search}`);
		return NextResponse.redirect(signIn);
	}

	const headers = new Headers(request.headers);
	headers.set(PATH_HEADER, `${pathname}${search}`);
	return NextResponse.next({ request: { headers } });
}

export const config = {
	matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)"],
};
