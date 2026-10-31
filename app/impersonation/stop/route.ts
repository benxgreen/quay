import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
	haloUserIdOf,
	IMPERSONATION_COOKIE,
	readImpersonation,
	recordImpersonationStop,
} from "@/lib/auth/impersonation";

/**
 * "Stop impersonating": clears the cookie, closes the audit record and goes
 * back to the user's page. Outside /manage so it works whatever roles the
 * impersonated person has. It only ever ends an impersonation, so a plain
 * link is safe.
 */
export async function GET(request: Request) {
	const cookieStore = await cookies();
	const token = readImpersonation(cookieStore.get(IMPERSONATION_COOKIE)?.value);
	cookieStore.delete(IMPERSONATION_COOKIE);

	let to = "/manage/users";
	if (token) {
		await recordImpersonationStop(token.adminUserId, token.userId);
		const haloUserId = await haloUserIdOf(token.userId);
		if (haloUserId) to = `/manage/users/${haloUserId}`;
	}
	return NextResponse.redirect(new URL(to, request.url));
}
