import "server-only";

import { cache } from "react";
import { getSignedInObjectId } from "@/lib/auth/session";
import { queryOne } from "@/lib/db/query";
import type { PortalRole } from "@/lib/portal/roles";

export type CurrentUser = {
	id: string;
	entraObjectId: string;
	displayName: string;
	firstName: string;
	email: string;
	username: string | null;
	jobTitle: string | null;
	department: string | null;
	roles: PortalRole[];
};

/**
 * The signed-in person, with their roles, read from portal.users on every
 * request (once per request), so a role change applies straight away. Null
 * when nobody is signed in or sign-in has not finished.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
	const entraObjectId = await getSignedInObjectId();
	if (!entraObjectId) return null;

	const row = await queryOne<{
		id: string;
		display_name: string;
		email: string;
		username: string | null;
		job_title: string | null;
		department: string | null;
		roles: PortalRole[];
	}>(
		`SELECT u.id, u.display_name, u.email, u.username, u.job_title, u.department,
		        coalesce(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
		 FROM portal.users u
		 LEFT JOIN portal.user_roles r ON r.user_id = u.id
		 WHERE u.entra_object_id = $1 AND u.active
		 GROUP BY u.id`,
		[entraObjectId],
	);
	if (!row) return null;

	return {
		id: row.id,
		entraObjectId,
		displayName: row.display_name,
		firstName: row.display_name.split(" ")[0],
		email: row.email,
		username: row.username,
		jobTitle: row.job_title,
		department: row.department,
		roles: row.roles,
	};
});
