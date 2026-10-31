"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, getRealUser } from "@/lib/auth/current-user";
import {
	getPortalUserByHaloId,
	IMPERSONATION_COOKIE,
	IMPERSONATION_MAX_AGE_SECONDS,
	recordImpersonationStart,
	signImpersonation,
} from "@/lib/auth/impersonation";
import { canImpersonate } from "@/lib/portal/impersonation";

/**
 * Start seeing the portal as a user. Checked again here: only an
 * Administrator who is not already impersonating, and only someone else
 * with a portal user.
 */
export async function startImpersonation(haloUserId: number) {
	const [real, current] = await Promise.all([getRealUser(), getCurrentUser()]);
	if (!real || !current) redirect("/sign-in");
	const target = await getPortalUserByHaloId(haloUserId);
	if (!target || !canImpersonate(real, current, target.id)) {
		redirect(current.roles.includes("administrator") ? `/manage/users/${haloUserId}` : "/my");
	}

	await recordImpersonationStart(real.id, target.id);
	(await cookies()).set(IMPERSONATION_COOKIE, signImpersonation(real.id, target.id), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: IMPERSONATION_MAX_AGE_SECONDS,
	});
	redirect(target.roles.length > 0 ? "/manage" : "/my");
}
