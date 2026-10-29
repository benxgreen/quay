import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PATH_HEADER, safeReturnTo } from "@/lib/auth/constants";
import { type CurrentUser, getCurrentUser } from "@/lib/auth/current-user";
import type { PortalRole } from "@/lib/portal/roles";

/**
 * The signed-in person, or a redirect to sign in and back. Use in layouts
 * and pages, and again in every server action: layouts are not re-run on
 * every navigation, so they are not the only check.
 */
export async function requireUser(): Promise<CurrentUser> {
	const user = await getCurrentUser();
	if (!user) {
		const returnTo = safeReturnTo((await headers()).get(PATH_HEADER));
		redirect(returnTo ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : "/sign-in");
	}
	return user;
}

/**
 * The signed-in person if they have any of the roles. Everyone who signs in
 * can use the portal; a page their roles don't cover sends them to their
 * own page, /my, rather than showing "no access".
 */
export async function requireRole(anyOf: readonly PortalRole[]): Promise<CurrentUser> {
	const user = await requireUser();
	if (!anyOf.some((role) => user.roles.includes(role))) {
		redirect("/my");
	}
	return user;
}
