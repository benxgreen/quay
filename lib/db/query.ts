import "server-only";

import type { QueryResultRow } from "pg";
import { getPool } from "@/lib/db/pool";

/** Any client that can run a query: the pool, or a client inside a transaction. */
export type Queryable = {
	query<R extends QueryResultRow = QueryResultRow>(
		text: string,
		values?: unknown[],
	): Promise<{ rows: R[]; rowCount: number | null }>;
};

/**
 * Runs one parameterised statement on the pool and returns its rows. For
 * anything that writes more than one row or table, use withTransaction.
 *
 * @example
 * const rows = await query<{ name: string }>("SELECT name FROM lr.software ORDER BY lower(name)");
 */
export async function query<R extends QueryResultRow = QueryResultRow>(
	text: string,
	values: unknown[] = [],
	db: Queryable = getPool(),
): Promise<R[]> {
	const result = await db.query<R>(text, values);
	return result.rows;
}

/** Like query, but returns the first row or undefined. */
export async function queryOne<R extends QueryResultRow = QueryResultRow>(
	text: string,
	values: unknown[] = [],
	db: Queryable = getPool(),
): Promise<R | undefined> {
	const rows = await query<R>(text, values, db);
	return rows[0];
}
