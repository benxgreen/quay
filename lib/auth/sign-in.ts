import "server-only";

import { ExternalCallError } from "@/lib/clients/connection-log";
import { ConnectionNotConfiguredError } from "@/lib/clients/connections";
import { getHaloUsersClient, type HaloUser, type HaloUsersClient } from "@/lib/clients/halo/users";
import type { Queryable } from "@/lib/db/query";
import { queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";

export type SignInResult =
	| { ok: true; userId: string; roles: string[] }
	| { ok: false; reason: "not_in_halo" | "account_disabled" | "halo_failed"; detail?: string };

/**
 * Finishes signing someone in: finds their Halo user by Entra object ID,
 * refuses anyone not in Halo or with a disabled account, and creates or
 * refreshes their portal user with Halo's details.
 */
export async function signInPortalUser(
	entraObjectId: string,
	users: HaloUsersClient = getHaloUsersClient(),
): Promise<SignInResult> {
	let halo: HaloUser | null;
	try {
		({ value: halo } = await users.findByEntraObjectId(entraObjectId, {
			trigger: { kind: "system", label: "Sign in" },
		}));
	} catch (error) {
		if (error instanceof ExternalCallError || error instanceof ConnectionNotConfiguredError) {
			return { ok: false, reason: "halo_failed", detail: error.message };
		}
		throw error;
	}

	if (!halo) return { ok: false, reason: "not_in_halo" };
	if (!halo.active) return { ok: false, reason: "account_disabled" };

	const signedIn = { ...halo, entraObjectId };
	return withTransaction(async (tx) => {
		const userId = await upsertUserFromHalo(tx, signedIn, {
			createdVia: "sign_in",
			signedIn: true,
		});
		const row = await queryOne<{ roles: string[] }>(
			`SELECT coalesce(array_agg(role ORDER BY role), '{}') AS roles
			 FROM portal.user_roles WHERE user_id = $1`,
			[userId],
			tx,
		);
		return { ok: true, userId, roles: row?.roles ?? [] };
	});
}

/**
 * Creates or refreshes a portal user from their Halo user. Matches on Entra
 * object ID, then Halo user ID, then email, so someone first added to a
 * case keeps the same portal user when they later sign in.
 */
export async function upsertUserFromHalo(
	db: Queryable,
	halo: HaloUser,
	{
		createdVia,
		createdBy,
		signedIn = false,
	}: { createdVia: "sign_in" | "case" | "role_granted"; createdBy?: string; signedIn?: boolean },
): Promise<string> {
	const existing = await queryOne<{ id: string }>(
		`SELECT id FROM portal.users
		 WHERE entra_object_id = $1 OR halo_user_id = $2 OR lower(email) = lower($3)
		 ORDER BY (entra_object_id = $1) DESC NULLS LAST, (halo_user_id = $2) DESC NULLS LAST
		 LIMIT 1
		 FOR UPDATE`,
		[halo.entraObjectId, halo.haloUserId, halo.email],
		db,
	);

	const details = [
		halo.entraObjectId,
		halo.haloUserId,
		halo.email,
		halo.displayName,
		halo.username,
		halo.jobTitle,
		halo.department,
		halo.active,
	];

	if (existing) {
		await queryOne(
			`UPDATE portal.users
			 SET entra_object_id = coalesce($1, entra_object_id), halo_user_id = $2, email = $3,
			     display_name = $4, username = $5, job_title = $6, department = $7, active = $8,
			     last_signed_in_at = CASE WHEN $9 THEN now() ELSE last_signed_in_at END
			 WHERE id = $10`,
			[...details, signedIn, existing.id],
			db,
		);
		return existing.id;
	}

	const created = await queryOne<{ id: string }>(
		`INSERT INTO portal.users
		   (entra_object_id, halo_user_id, email, display_name, username, job_title, department, active,
		    last_signed_in_at, created_via, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $9 THEN now() END, $10, $11)
		 RETURNING id`,
		[...details, signedIn, createdVia, createdBy ?? null],
		db,
	);
	if (!created) throw new Error("Could not create the portal user");
	return created.id;
}
