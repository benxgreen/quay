/**
 * Import and the invitation queue against the local database, with the
 * mock Halo report: refresh, sort into eligible / needs attention / hidden,
 * add to the queue, move, change type and remove. Cleans up as
 * portal_migrator. Skipped when DATABASE_URL is not set.
 */
import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.MIGRATE_DATABASE_URL);
const JOHN = "00000000-0000-4000-8000-000000000001";
const ASSET = "31993"; // Mohammed Ali's laptop in mocks/halo.ts

describe.skipIf(!hasDatabase)("import and queue against the local database", async () => {
	const { getPool } = await import("@/lib/db/pool");
	const { queryOne } = await import("@/lib/db/query");
	const importing = await import("@/services/replacements/laptops/lib/import");
	const queue = await import("@/services/replacements/laptops/lib/queue");
	const started = new Date();
	let hadUser = false;

	const admin = async (work: (client: pg.Client) => Promise<unknown>) => {
		const client = new pg.Client({ connectionString: process.env.MIGRATE_DATABASE_URL });
		await client.connect();
		try {
			await work(client);
		} finally {
			await client.end();
		}
	};

	beforeAll(async () => {
		hadUser = Boolean(await queryOne("SELECT 1 FROM portal.users WHERE halo_user_id = 1023"));
	});

	afterAll(async () => {
		await admin(async (client) => {
			await client.query(
				"DELETE FROM lr.cases WHERE old_asset_id = $1 AND created_at >= $2",
				[ASSET, started],
			);
			await client.query("DELETE FROM lr.imports WHERE imported_at >= $1", [started]);
			if (!hadUser) await client.query("DELETE FROM portal.users WHERE halo_user_id = 1023");
		});
		await getPool().end();
	});

	it("refreshes from Halo and sorts the report", async () => {
		const refreshed = await importing.refreshReport(JOHN);
		expect(refreshed).toEqual({ ok: true, value: 12 });

		const report = await importing.getReport();
		const view = await importing.getImportView(report as NonNullable<typeof report>);
		expect(view.eligible.map((device) => device.assetId)).toContain(ASSET);
		expect(
			Object.fromEntries(view.attention.map((device) => [device.assetId, device.userCheck])),
		).toEqual({ 31995: "no_user", 31996: "disabled", 31997: "not_found" });
		expect(
			Object.fromEntries(view.hidden.map((device) => [device.assetId, device.reason.kind])),
		).toMatchObject({ 31877: "open_case", 31818: "open_case", 29001: "previous" });
	});

	it("queues a laptop, moves it, changes its type and removes it", async () => {
		const added = await importing.addToQueue([ASSET], "collection", JOHN);
		expect(added).toMatchObject({ ok: true, cases: [{ name: "Mohammed Ali" }] });
		const caseId = added.ok ? added.cases[0].id : "";

		const before = await queue.getQueuedCase(caseId);
		expect(before?.position).toBe(await queue.queueLength());

		expect(await queue.moveToFront(caseId, JOHN)).toBe(true);
		expect((await queue.getQueuedCase(caseId))?.position).toBe(1);

		expect(await queue.changeQueuedType(caseId, "session", JOHN)).toBe(true);
		expect(await queue.getQueuedCase(caseId)).toMatchObject({ type: "session", position: 1 });

		expect(await queue.removeFromQueue(caseId, JOHN)).toBe(true);
		expect(
			await queryOne("SELECT status, withdrawn_reason FROM lr.cases WHERE id = $1", [caseId]),
		).toEqual({ status: "withdrawn", withdrawn_reason: queue.REMOVED_FROM_QUEUE });

		const report = await importing.getReport();
		const view = await importing.getImportView(report as NonNullable<typeof report>);
		expect(view.eligible.map((device) => device.assetId)).toContain(ASSET);
	});

	it("won't queue a laptop that isn't eligible", async () => {
		expect(await importing.addToQueue(["31996"], "collection", JOHN)).toEqual({
			ok: false,
			error: "Select at least one laptop to add to the invitation queue",
		});
	});
});
