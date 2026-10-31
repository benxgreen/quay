import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { IMPERSONATION_COOKIE, readImpersonation } from "@/lib/auth/impersonation";
import { getSignedInObjectId } from "@/lib/auth/session";
import { queryOne } from "@/lib/db/query";
import type { PortalRole } from "@/lib/portal/roles";

export type CurrentUser = {
	id: string;
	/** Null only for an impersonated person who has never signed in. */
	entraObjectId: string | null;
	displayName: string;
	firstName: string;
	email: string;
	username: string | null;
	jobTitle: string | null;
	department: string | null;
	roles: PortalRole[];
	/**
	 * Who is really doing things: the same as `id`, or the Administrator when
	 * they are impersonating. Journal entries, logs and "changed by" use this.
	 */
	actorId: string;
	/** The Administrator seeing the portal as this person, when impersonating. */
	impersonator: { id: string; displayName: string; email: string } | null;
};

type UserRow = {
	id: string;
	entra_object_id: string | null;
	display_name: string;
	email: string;
	username: string | null;
	job_title: string | null;
	department: string | null;
	roles: PortalRole[];
};

const SELECT_USER = `SELECT u.id, u.entra_object_id, u.display_name, u.email, u.username, u.job_title, u.department,
        coalesce(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
 FROM portal.users u
 LEFT JOIN portal.user_roles r ON r.user_id = u.id`;

function toCurrentUser(row: UserRow): Omit<CurrentUser, "actorId" | "impersonator"> {
	return {
		id: row.id,
		entraObjectId: row.entra_object_id,
		displayName: row.display_name,
		firstName: row.display_name.split(" ")[0],
		email: row.email,
		username: row.username,
		jobTitle: row.job_title,
		department: row.department,
		roles: row.roles,
	};
}

/**
 * The person really signed in, ignoring any impersonation. Only for
 * starting and stopping impersonation; everything else uses getCurrentUser.
 */
export const getRealUser = cache(async () => {
	const entraObjectId = await getSignedInObjectId();
	if (!entraObjectId) return null;
	const row = await queryOne<UserRow>(
		`${SELECT_USER} WHERE u.entra_object_id = $1 AND u.active GROUP BY u.id`,
		[entraObjectId],
	);
	return row ? toCurrentUser(row) : null;
});

/**
 * The signed-in person, with their roles, read from portal.users on every
 * request (once per request), so a role change applies straight away. Null
 * when nobody is signed in or sign-in has not finished.
 *
 * While an Administrator impersonates someone, this is that person with
 * their roles, and `impersonator` and `actorId` name the Administrator. The
 * impersonation is only honoured while the real person is still the
 * Administrator who started it and still has the Administrator role.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
	const real = await getRealUser();
	if (!real) return null;
	const self = { ...real, actorId: real.id, impersonator: null };

	const token = readImpersonation((await cookies()).get(IMPERSONATION_COOKIE)?.value);
	if (!token || token.adminUserId !== real.id || !real.roles.includes("administrator")) {
		return self;
	}
	const row = await queryOne<UserRow>(
		`${SELECT_USER} WHERE u.id = $1 AND u.active GROUP BY u.id`,
		[token.userId],
	);
	if (!row || row.id === real.id) return self;
	return {
		...toCurrentUser(row),
		actorId: real.id,
		impersonator: { id: real.id, displayName: real.displayName, email: real.email },
	};
});
