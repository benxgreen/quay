import "server-only";

import pg from "pg";

// Dates (type 1082) come back as "YYYY-MM-DD" strings rather than JavaScript
// Dates at midnight UTC, so a date is never shifted by a time zone.
// timestamptz still comes back as a Date.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

// Reuse one pool across hot reloads in development.
const globalForPool = globalThis as unknown as { quayPool?: pg.Pool };

/**
 * The app's connection pool: portal_app through PgBouncer (port 6432) in
 * transaction mode. Created on first use so builds don't need DATABASE_URL.
 *
 * PgBouncer rules (CLAUDE.md): schema-qualify every table, no session
 * features (SET, LISTEN, advisory locks, temp tables), and never pass `name`
 * to a query.
 */
export function getPool(): pg.Pool {
	if (!globalForPool.quayPool) {
		const connectionString = process.env.DATABASE_URL;
		if (!connectionString) {
			throw new Error("DATABASE_URL is not set");
		}
		globalForPool.quayPool = new pg.Pool({ connectionString, max: 10 });
	}
	return globalForPool.quayPool;
}
