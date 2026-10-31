import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { query, queryOne } from "@/lib/db/query";
import type { PortalRole } from "@/lib/portal/roles";

/**
 * Impersonation: an Administrator sees the portal as another user. The
 * cookie says which Administrator started it and as whom, signed so it
 * can't be forged or handed to someone else, and expires after a working
 * day. getCurrentUser() reads it on every request and only honours it
 * while the real person is still that Administrator (lib/auth/current-user.ts).
 */
export const IMPERSONATION_COOKIE = "quay_impersonation";

/** How long one impersonation lasts before it stops by itself. */
export const IMPERSONATION_MAX_AGE_SECONDS = 8 * 60 * 60;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const TOKEN = new RegExp(`^(${UUID})\\.(${UUID})\\.(\\d+)\\.([\\w-]{43})$`);

function secret(): string {
	const value = process.env.BETTER_AUTH_SECRET || process.env.CASE_LINK_SECRET;
	if (!value) throw new Error("BETTER_AUTH_SECRET (or CASE_LINK_SECRET) is not set");
	return value;
}

function sign(payload: string): string {
	return createHmac("sha256", secret()).update(`impersonation:${payload}`).digest("base64url");
}

export type ImpersonationToken = { adminUserId: string; userId: string; startedAt: number };

/** The cookie value for an Administrator impersonating a user. */
export function signImpersonation(
	adminUserId: string,
	userId: string,
	now: Date = new Date(),
): string {
	const payload = `${adminUserId}.${userId}.${Math.floor(now.getTime() / 1000)}`;
	return `${payload}.${sign(payload)}`;
}

/** Who is impersonating whom, or null if the cookie is missing, forged or expired. */
export function readImpersonation(
	token: string | undefined,
	now: Date = new Date(),
): ImpersonationToken | null {
	const match = token?.match(TOKEN);
	if (!match) return null;
	const [, adminUserId, userId, issued] = match;
	const expected = Buffer.from(sign(`${adminUserId}.${userId}.${issued}`));
	const given = Buffer.from(match[4]);
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
	const age = now.getTime() / 1000 - Number(issued);
	if (age < 0 || age > IMPERSONATION_MAX_AGE_SECONDS) return null;
	return { adminUserId, userId, startedAt: Number(issued) };
}

/** The audit record: written when an impersonation starts. */
export async function recordImpersonationStart(adminUserId: string, userId: string) {
	await query("INSERT INTO portal.impersonations (admin_user_id, user_id) VALUES ($1, $2)", [
		adminUserId,
		userId,
	]);
}

/** Closes the open audit record when an impersonation stops. */
export async function recordImpersonationStop(adminUserId: string, userId: string) {
	await query(
		`UPDATE portal.impersonations SET ended_at = now()
		 WHERE admin_user_id = $1 AND user_id = $2 AND ended_at IS NULL`,
		[adminUserId, userId],
	);
}

/** The Halo user ID of a portal user, to go back to their page. */
export async function haloUserIdOf(userId: string): Promise<number | null> {
	const row = await queryOne<{ halo_user_id: number | null }>(
		"SELECT halo_user_id FROM portal.users WHERE id = $1",
		[userId],
	);
	return row?.halo_user_id ?? null;
}

/** An active portal user, found by their Halo user ID, with their roles. */
export async function getPortalUserByHaloId(
	haloUserId: number,
): Promise<{ id: string; displayName: string; roles: PortalRole[] } | null> {
	const row = await queryOne<{ id: string; display_name: string; roles: PortalRole[] }>(
		`SELECT u.id, u.display_name,
		        coalesce(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
		 FROM portal.users u
		 LEFT JOIN portal.user_roles r ON r.user_id = u.id
		 WHERE u.halo_user_id = $1 AND u.active
		 GROUP BY u.id`,
		[haloUserId],
	);
	return row ? { id: row.id, displayName: row.display_name, roles: row.roles } : null;
}
