/**
 * The connection logger against the local database, as portal_app. Skipped
 * when DATABASE_URL is not set.
 */
import { existsSync } from "node:fs";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("connection log against the local database", async () => {
	const { getPool } = await import("@/lib/db/pool");
	const { query, queryOne } = await import("@/lib/db/query");
	const { callExternal, HttpStatusError } = await import("@/lib/clients/connection-log");
	const logIds: number[] = [];

	afterAll(async () => {
		await query("DELETE FROM portal.connection_log WHERE id = ANY($1::bigint[])", [logIds]);
		await getPool().end();
	});

	it("writes a row for a successful and a failed call", async () => {
		const context = { trigger: { kind: "system" as const, label: "Test" } };
		const ok = await callExternal("halo", context, async () => ({
			value: null,
			statusCode: 200,
			summary: "10 devices",
		}));
		const failed = await callExternal("email_webhook", context, async () => {
			throw new HttpStatusError(502, "Power Automate returned 502 Bad Gateway");
		}).catch((error: { logId?: number }) => error);

		logIds.push(Number(ok.logId), Number(failed.logId));
		const rows = await query<{ connection: string; outcome: string; status_code: number }>(
			`SELECT connection, outcome, status_code FROM portal.connection_log
			 WHERE id = ANY($1::bigint[]) ORDER BY id`,
			[logIds],
		);
		expect(rows).toEqual([
			{ connection: "halo", outcome: "success", status_code: 200 },
			{ connection: "email_webhook", outcome: "failed", status_code: 502 },
		]);

		const error = await queryOne<{ error: string }>(
			"SELECT error FROM portal.connection_log WHERE id = $1",
			[failed.logId],
		);
		expect(error?.error).toBe("Power Automate returned 502 Bad Gateway");
	});

	it("journals a failed action with a Failed tag, rolled back afterwards", async () => {
		const { journalFailure } = await import("@/services/replacements/laptops/lib/journal");
		const client = await getPool().connect();
		try {
			await client.query("BEGIN");
			const caseRow = await queryOne<{ id: string }>(
				"SELECT id FROM lr.cases ORDER BY id LIMIT 1",
				[],
				client,
			);
			const id = await journalFailure(
				{
					caseId: String(caseRow?.id),
					actor: { system: "Test" },
					kind: "status",
					action: "Complete replacement",
				},
				client,
			)({
				connection: "halo",
				message: "Halo returned 503 Service Unavailable",
				statusCode: 503,
				timedOut: false,
				at: new Date(),
			});

			const entry = await queryOne<{
				body: string;
				outcome: string;
				data: { connection: string };
			}>("SELECT body, outcome, data FROM lr.journal_entries WHERE id = $1", [id], client);
			expect(entry).toMatchObject({
				body: "Complete replacement failed: Halo returned 503 Service Unavailable",
				outcome: "failed",
				data: { connection: "halo" },
			});
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	});
});
