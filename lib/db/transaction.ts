import "server-only";

import type pg from "pg";
import { getPool } from "@/lib/db/pool";

type PoolLike = { connect(): Promise<Pick<pg.PoolClient, "query" | "release">> };

type TransactionOptions = {
	/**
	 * The signed-in user making the change. Set with set_config(…, true) so it
	 * lasts only for this transaction (safe through PgBouncer); triggers such
	 * as role history read it as portal.acting_user.
	 */
	actingUserId?: string;
};

/**
 * Runs `work` inside BEGIN/COMMIT on one client, rolling back if it throws.
 * Every multi-step write goes through this: for example a booking, its
 * journal entry and the case's status change.
 *
 * @example
 * await withTransaction(async (tx) => {
 *   await tx.query("UPDATE lr.cases SET status = 'booked' WHERE id = $1", [caseId]);
 *   await tx.query("INSERT INTO lr.journal_entries (…) VALUES (…)", […]);
 * }, { actingUserId: user.id });
 */
export async function withTransaction<T>(
	work: (tx: Pick<pg.PoolClient, "query">) => Promise<T>,
	{ actingUserId }: TransactionOptions = {},
	pool: PoolLike = getPool(),
): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		if (actingUserId) {
			await client.query("SELECT set_config('portal.acting_user', $1, true)", [actingUserId]);
		}
		const result = await work(client);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}
