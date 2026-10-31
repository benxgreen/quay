"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { isPortalRole } from "@/lib/portal/roles";
import { listUsers, saveUserRoles, type UserFilters } from "@/lib/portal/users";
import { toTableRows, type UserTableRow } from "./rows";

/** The next batch for "Show more". */
export async function loadMoreUsers(filters: UserFilters, offset: number): Promise<UserTableRow[]> {
	const user = await requireRole(ACCESS.management);
	const page = await listUsers(filters, offset, {
		trigger: { kind: "user", label: "Users", actorUserId: user.actorId },
	});
	return toTableRows(page.rows);
}

export type SaveRolesState = { error?: string };

/** Save roles on a user's page, then back to it with a success banner. */
export async function saveRoles(
	haloUserId: number,
	_state: SaveRolesState,
	formData: FormData,
): Promise<SaveRolesState> {
	const user = await requireRole(ACCESS.management);
	const roles = formData.getAll("roles").map(String).filter(isPortalRole);
	const result = await saveUserRoles(haloUserId, roles, user.actorId, {
		trigger: { kind: "user", label: "Save roles", actorUserId: user.actorId },
	});
	if (!result.ok) return { error: result.error };
	redirect(`/manage/users/${haloUserId}?saved=1`);
}
