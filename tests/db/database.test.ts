/**
 * Runs lib/db against the local database through PgBouncer, as portal_app.
 * Needs `npm run db:up` and a seeded database; skipped when DATABASE_URL is
 * not set (for example in CI without a database).
 */
import { existsSync } from "node:fs";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("lib/db against the local database", async () => {
	const { getPool } = await import("@/lib/db/pool");
	const { query, queryOne } = await import("@/lib/db/query");
	const { withTransaction } = await import("@/lib/db/transaction");
	const { describeConstraintError } = await import("@/lib/db/errors");

	afterAll(async () => {
		await getPool().end();
	});

	it("reads through PgBouncer as portal_app, with dates as plain strings", async () => {
		const row = await queryOne<{ who: string; day: string }>(
			"SELECT current_user AS who, lr.add_working_days('2026-11-12'::date, 3) AS day",
		);
		expect(row).toEqual({ who: "portal_app", day: "2026-11-17" });
	});

	it("reads the seeded software list in name order", async () => {
		const rows = await query<{ name: string }>(
			"SELECT name FROM lr.software ORDER BY lower(name)",
		);
		expect(rows[0]?.name).toBe("Adobe Acrobat Pro");
	});

	it("rolls back everything when a step fails", async () => {
		await expect(
			withTransaction(async (tx) => {
				await tx.query("INSERT INTO lr.imports (rows_total) VALUES (999)");
				throw new Error("stop");
			}),
		).rejects.toThrow("stop");

		const left = await queryOne<{ n: number }>(
			"SELECT count(*)::int AS n FROM lr.imports WHERE rows_total = 999",
		);
		expect(left?.n).toBe(0);
	});

	it("sets the acting user for this transaction only", async () => {
		const john = "00000000-0000-4000-8000-000000000001";
		const inside = await withTransaction(
			async (tx) =>
				(await tx.query("SELECT current_setting('portal.acting_user', true) AS v")).rows[0]
					.v,
			{ actingUserId: john },
		);
		expect(inside).toBe(john);

		const after = await queryOne<{ v: string | null }>(
			"SELECT nullif(current_setting('portal.acting_user', true), '') AS v",
		);
		expect(after?.v).toBeNull();
	});

	it("turns an overbooked session into a friendly message", async () => {
		const error = await withTransaction(async (tx) => {
			const session = await tx.query(
				"SELECT id FROM lr.sessions WHERE status = 'open' AND booked_count > 0 ORDER BY starts_at LIMIT 1",
			);
			await tx.query("UPDATE lr.sessions SET capacity = booked_count WHERE id = $1", [
				session.rows[0].id,
			]);
			const caseRow = await tx.query(
				"SELECT id FROM lr.cases WHERE status = 'pending' AND session_type = (SELECT session_type FROM lr.sessions WHERE id = $1) LIMIT 1",
				[session.rows[0].id],
			);
			await tx.query("INSERT INTO lr.bookings (case_id, session_id) VALUES ($1, $2)", [
				caseRow.rows[0].id,
				session.rows[0].id,
			]);
		}).catch((caught: unknown) => caught);

		expect(describeConstraintError(error)?.problem).toBe("session_unavailable");
	});
});
