import "server-only";

import { upsertUserFromHalo } from "@/lib/auth/sign-in";
import type { CallContext } from "@/lib/clients/connection-log";
import { getHaloUsersClient, type HaloUser } from "@/lib/clients/halo/users";
import { query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import { PORTAL_ROLES, type PortalRole, ROLE_LABELS } from "@/lib/portal/roles";

/**
 * The Users pages (spec, "Users and portal Settings"). Everyone in the staff
 * directory comes from Halo; a portal user exists only once something has
 * happened for them (sign-in, a case, a role).
 */

export type UserFilters = {
	search: string;
	/** A role, "none" for colleagues with no role, or "" for all. */
	role: PortalRole | "none" | "";
	show: "directory" | "portal";
};

export type UserListRow = {
	haloUserId: number | null;
	name: string;
	email: string;
	jobTitle: string | null;
	department: string | null;
	roles: PortalRole[];
	portalUser: boolean;
	lastSignedInAt: Date | null;
};

export type UserListPage = { rows: UserListRow[]; total: number };

export type UserCounts = { directory: number; portalUsers: number; withRole: number };

export const USERS_PAGE_SIZE = 20;

type PortalRow = {
	id: string;
	halo_user_id: number | null;
	display_name: string;
	email: string;
	job_title: string | null;
	department: string | null;
	last_signed_in_at: Date | null;
	roles: PortalRole[];
};

const PORTAL_COLUMNS = `
	u.id, u.halo_user_id, u.display_name, u.email, u.job_title, u.department, u.last_signed_in_at,
	coalesce(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles`;

export function parseUserFilters(params: Record<string, string | undefined>): UserFilters {
	const role = params.role ?? "";
	return {
		search: (params.q ?? "").trim(),
		role:
			role === "none" || (PORTAL_ROLES as readonly string[]).includes(role)
				? (role as UserFilters["role"])
				: "",
		show: params.show === "portal" ? "portal" : "directory",
	};
}

/**
 * One batch of the list. Everyone in the directory comes from Halo, page by
 * page, with portal details added. A role filter or "Portal users only"
 * lists portal users from the database instead, because only they can have
 * roles; "Colleague (no role)" then means portal users without a role.
 */
export async function listUsers(
	filters: UserFilters,
	offset: number,
	context: CallContext,
): Promise<UserListPage> {
	if (filters.show === "portal" || filters.role) {
		return listPortalUsers(filters, offset);
	}

	const { value: page } = await getHaloUsersClient().list(
		{
			search: filters.search,
			pageNo: Math.floor(offset / USERS_PAGE_SIZE) + 1,
			pageSize: USERS_PAGE_SIZE,
		},
		context,
	);
	const portal = await query<PortalRow>(
		`SELECT ${PORTAL_COLUMNS}
		 FROM portal.users u LEFT JOIN portal.user_roles r ON r.user_id = u.id
		 WHERE u.halo_user_id = ANY($1::int[])
		 GROUP BY u.id`,
		[page.users.map((user) => user.haloUserId)],
	);
	const byHaloId = new Map(portal.map((row) => [row.halo_user_id, row]));

	return {
		total: page.total,
		rows: page.users.map((user) => {
			const row = byHaloId.get(user.haloUserId);
			return {
				haloUserId: user.haloUserId,
				name: user.displayName,
				email: user.email,
				jobTitle: user.jobTitle,
				department: user.department ?? row?.department ?? null,
				roles: row?.roles ?? [],
				portalUser: Boolean(row),
				lastSignedInAt: row?.last_signed_in_at ?? null,
			};
		}),
	};
}

async function listPortalUsers(filters: UserFilters, offset: number): Promise<UserListPage> {
	const like = `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
	const rows = await query<PortalRow & { total: string }>(
		`SELECT ${PORTAL_COLUMNS}, count(*) OVER () AS total
		 FROM portal.users u LEFT JOIN portal.user_roles r ON r.user_id = u.id
		 WHERE ($1 = '%%' OR u.display_name ILIKE $1 OR u.email ILIKE $1 OR u.username ILIKE $1)
		 GROUP BY u.id
		 HAVING $2 = '' OR ($2 = 'none' AND count(r.role) = 0) OR bool_or(r.role = $2)
		 ORDER BY lower(u.display_name), u.id
		 LIMIT $3 OFFSET $4`,
		[like, filters.role, USERS_PAGE_SIZE, offset],
	);
	return {
		total: Number(rows[0]?.total ?? 0),
		rows: rows.map((row) => ({
			haloUserId: row.halo_user_id,
			name: row.display_name,
			email: row.email,
			jobTitle: row.job_title,
			department: row.department,
			roles: row.roles,
			portalUser: true,
			lastSignedInAt: row.last_signed_in_at,
		})),
	};
}

/** "4,812 people in the directory · 236 portal users · 6 with a role". */
export async function countUsers(context: CallContext): Promise<UserCounts> {
	const [{ value: directory }, counts] = await Promise.all([
		getHaloUsersClient().list({ pageNo: 1, pageSize: 1 }, context),
		queryOne<{ portal_users: string; with_role: string }>(
			`SELECT (SELECT count(*) FROM portal.users) AS portal_users,
			        (SELECT count(DISTINCT user_id) FROM portal.user_roles) AS with_role`,
		),
	]);
	return {
		directory: directory.total,
		portalUsers: Number(counts?.portal_users ?? 0),
		withRole: Number(counts?.with_role ?? 0),
	};
}

export type RoleChange = {
	at: Date;
	by: string | null;
	added: PortalRole[];
	removed: PortalRole[];
};

export type UserDetail = {
	halo: HaloUser;
	/**
	 * A portal user has this Halo ID but a different email, so they are not
	 * the same person (a reused Halo ID, or local data seeded from the mock
	 * Halo while HALO_CLIENT=http). Their portal details are left off.
	 */
	mismatch: { name: string } | null;
	portal: {
		id: string;
		createdAt: Date;
		createdVia: "sign_in" | "case" | "role_granted";
		createdBy: string | null;
		lastSignedInAt: Date | null;
		roles: PortalRole[];
		cases: { reference: string; status: string }[];
		roleHistory: RoleChange[];
	} | null;
};

/** Everything on a user's page: Halo's details, and their portal user if they have one. */
export async function getUserDetail(
	haloUserId: number,
	context: CallContext,
): Promise<UserDetail | null> {
	const { value: halo } = await getHaloUsersClient().get(haloUserId, context);
	if (!halo) return null;

	const row = await queryOne<{
		id: string;
		display_name: string;
		email: string;
		created_at: Date;
		created_via: "sign_in" | "case" | "role_granted";
		created_by: string | null;
		last_signed_in_at: Date | null;
		roles: PortalRole[];
	}>(
		`SELECT u.id, u.display_name, u.email, u.created_at, u.created_via, cb.display_name AS created_by, u.last_signed_in_at,
		        coalesce(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
		 FROM portal.users u
		 LEFT JOIN portal.users cb ON cb.id = u.created_by
		 LEFT JOIN portal.user_roles r ON r.user_id = u.id
		 WHERE u.halo_user_id = $1
		 GROUP BY u.id, cb.display_name`,
		[haloUserId],
	);
	if (!row) return { halo, portal: null, mismatch: null };
	if (!sameEmail(row.email, halo.email)) {
		return { halo, portal: null, mismatch: { name: row.display_name } };
	}

	const [cases, history] = await Promise.all([
		query<{ reference: string; status: string }>(
			"SELECT reference, status FROM lr.cases WHERE user_id = $1 ORDER BY id DESC",
			[row.id],
		),
		query<{
			role: PortalRole;
			change: "added" | "removed";
			changed_at: Date;
			by: string | null;
		}>(
			`SELECT h.role, h.change, h.changed_at, cb.display_name AS by
			 FROM portal.user_role_history h LEFT JOIN portal.users cb ON cb.id = h.changed_by
			 WHERE h.user_id = $1
			 ORDER BY h.changed_at DESC, h.id`,
			[row.id],
		),
	]);

	return {
		halo,
		mismatch: null,
		portal: {
			id: row.id,
			createdAt: row.created_at,
			createdVia: row.created_via,
			createdBy: row.created_by,
			lastSignedInAt: row.last_signed_in_at,
			roles: row.roles,
			cases,
			roleHistory: groupRoleChanges(history),
		},
	};
}

/** Changes saved together (same time, same person) read as one line. */
export function groupRoleChanges(
	history: {
		role: PortalRole;
		change: "added" | "removed";
		changed_at: Date;
		by: string | null;
	}[],
): RoleChange[] {
	const groups: RoleChange[] = [];
	for (const entry of history) {
		let group = groups.at(-1);
		if (!group || group.at.getTime() !== entry.changed_at.getTime() || group.by !== entry.by) {
			group = { at: entry.changed_at, by: entry.by, added: [], removed: [] };
			groups.push(group);
		}
		group[entry.change].push(entry.role);
	}
	return groups;
}

export type SaveRolesResult = { ok: true; name: string } | { ok: false; error: string };

/**
 * Saves a person's roles. Creates their portal user from Halo first if
 * they don't have one ("when given a role by …"). The role history is
 * written by the database trigger, with the acting user. Refuses to remove
 * the last Administrator, so the portal can always be managed.
 */
export async function saveUserRoles(
	haloUserId: number,
	roles: PortalRole[],
	actorId: string,
	context: CallContext,
): Promise<SaveRolesResult> {
	const existing = await queryOne<{ id: string; display_name: string; email: string }>(
		"SELECT id, display_name, email FROM portal.users WHERE halo_user_id = $1",
		[haloUserId],
	);
	const { value: halo } = await getHaloUsersClient().get(haloUserId, context);
	if (!halo) return { ok: false, error: "This person is no longer in the staff directory" };
	if (existing && !sameEmail(existing.email, halo.email)) {
		return {
			ok: false,
			error: `Roles cannot be saved: the portal user with this Halo ID is ${existing.display_name}, not ${halo.displayName}`,
		};
	}

	return withTransaction(
		async (tx) => {
			const userId =
				existing?.id ??
				(await upsertUserFromHalo(tx, halo, {
					createdVia: "role_granted",
					createdBy: actorId,
				}));
			const current = await query<{ role: PortalRole }>(
				"SELECT role FROM portal.user_roles WHERE user_id = $1 FOR UPDATE",
				[userId],
				tx,
			);
			const had = current.map((row) => row.role);
			const removed = had.filter((role) => !roles.includes(role));
			const added = roles.filter((role) => !had.includes(role));

			if (removed.includes("administrator")) {
				const others = await queryOne<{ count: string }>(
					`SELECT count(*) FROM portal.user_roles
					 WHERE role = 'administrator' AND user_id <> $1`,
					[userId],
					tx,
				);
				if (Number(others?.count) === 0) {
					return {
						ok: false,
						error: "There must be at least one Administrator",
					} as const;
				}
			}

			if (removed.length > 0) {
				await query(
					"DELETE FROM portal.user_roles WHERE user_id = $1 AND role = ANY($2)",
					[userId, removed],
					tx,
				);
			}
			for (const role of added) {
				await query(
					"INSERT INTO portal.user_roles (user_id, role, granted_by) VALUES ($1, $2, $3)",
					[userId, role, actorId],
					tx,
				);
			}
			return {
				ok: true,
				name: existing?.display_name ?? (halo as HaloUser).displayName,
			} as const;
		},
		{ actingUserId: actorId },
	);
}

/** "Laptop replacements team added and Laptop replacements admin removed by Ben Green". */
export function describeChange({ added, removed, by }: RoleChange): string {
	const list = (roles: RoleChange["added"]) => {
		const labels = roles.map((role) => ROLE_LABELS[role]);
		return labels.length > 1
			? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`
			: labels[0];
	};
	const parts = [
		added.length > 0 ? `${list(added)} added` : null,
		removed.length > 0 ? `${list(removed)} removed` : null,
	].filter(Boolean);
	return `${parts.join(" and ")}${by ? ` by ${by}` : ""}`;
}

function sameEmail(a: string | null, b: string | null): boolean {
	return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}
