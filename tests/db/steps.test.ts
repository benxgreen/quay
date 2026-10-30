/**
 * The six case steps against the local database with the mock Halo:
 * allocate, prepare, software, complete (with Halo failing first), return,
 * decommission, and a checklist changed in Settings. Cleans up as
 * portal_migrator. Skipped without a database.
 */
import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.MIGRATE_DATABASE_URL);
const JOHN = "00000000-0000-4000-8000-000000000001";

describe.skipIf(!hasDatabase)("case steps against the local database", async () => {
	const { getPool } = await import("@/lib/db/pool");
	const { query, queryOne } = await import("@/lib/db/query");
	const { londonToday } = await import("@/lib/clock");
	const { addDays } = await import("@/lib/dates/working-days");
	const { createSession } = await import("@/services/replacements/laptops/lib/sessions");
	const { getCase } = await import("@/services/replacements/laptops/lib/cases");
	const steps = await import("@/services/replacements/laptops/lib/steps");
	const stock = await import("@/services/replacements/laptops/lib/stock");

	let sessionId = "";
	let caseId = "";
	let reference = "";
	let box = "";
	let itemId = "";
	const load = async () => {
		const detail = await getCase(reference);
		if (!detail) throw new Error("case not found");
		return detail;
	};
	const ok = { ok: true };

	beforeAll(async () => {
		await stock.refreshStock(JOHN);
		sessionId = await createSession(
			{
				type: "collection",
				date: addDays(londonToday(), 4),
				time: "10:00",
				capacity: 3,
				location: "Test",
			},
			JOHN,
		);
		const row = await queryOne<{ id: string; reference: string }>(
			`INSERT INTO lr.cases (user_id, session_type, status, old_asset_id, old_serial, invited_at)
			 SELECT id, 'collection', 'booked', 'TEST-STEPS', 'TESTSERIAL3', now()
			 FROM portal.users WHERE email = 'tom.fielding@bcpcouncil.test'
			 RETURNING id, reference`,
		);
		caseId = row?.id ?? "";
		reference = row?.reference ?? "";
		await query(
			"INSERT INTO lr.bookings (case_id, session_id, software_requested) VALUES ($1, $2, '{Power BI,Microsoft Visio}')",
			[caseId, sessionId],
		);
	});

	afterAll(async () => {
		const admin = new pg.Client({ connectionString: process.env.MIGRATE_DATABASE_URL });
		await admin.connect();
		await admin.query("DELETE FROM lr.email_sends WHERE case_id = $1", [caseId]);
		await admin.query("DELETE FROM lr.device_journal WHERE case_id = $1", [caseId]);
		await admin.query("DELETE FROM lr.cases WHERE id = $1", [caseId]);
		await admin.query("DELETE FROM lr.sessions WHERE id = $1", [sessionId]);
		if (itemId) await admin.query("DELETE FROM lr.checklist_items WHERE id = $1", [itemId]);
		await admin.end();
		await getPool().end();
	});

	it("allocates a box from stock and copies the preparation checks", async () => {
		const devices = await stock.availableDevices(JOHN);
		box = devices[0].assetId;
		expect(await steps.allocateDevice(await load(), box, JOHN)).toEqual(ok);
		const detail = await load();
		expect(detail).toMatchObject({ boxNumber: box, step: 2 });
		expect((await stock.availableDevices(JOHN)).map((d) => d.assetId)).not.toContain(box);
		expect((await steps.getStepData(detail)).prepChecks.length).toBeGreaterThan(0);
	});

	it("brings a checklist up to date with Settings, keeping saved ticks", async () => {
		const first = (await steps.getStepData(await load())).prepChecks[0];
		await steps.savePreparation(await load(), [first.id], false, JOHN);
		const item = await queryOne<{ id: string }>(
			"INSERT INTO lr.checklist_items (list, label, sort_order) VALUES ('device_preparation', 'Test: dock firmware', 99) RETURNING id",
		);
		itemId = item?.id ?? "";

		const before = await steps.getStepData(await load());
		expect(before.prepChange).toEqual({ added: ["Test: dock firmware"], removed: [] });
		expect(await steps.updateChecklist(await load(), "device_preparation", JOHN)).toEqual(ok);
		const after = await steps.getStepData(await load());
		expect(after.prepChange).toBeNull();
		expect(after.prepChecks.at(-1)).toMatchObject({
			label: "Test: dock firmware",
			ticked: false,
		});
		expect(after.prepChecks.find((check) => check.id === first.id)?.ticked).toBe(true);
	});

	it("won't confirm until everything is ticked, then moves on", async () => {
		const checks = (await steps.getStepData(await load())).prepChecks;
		expect(await steps.savePreparation(await load(), [checks[0].id], true, JOHN)).toMatchObject(
			{ ok: false },
		);
		expect(
			await steps.savePreparation(
				await load(),
				checks.map((c) => c.id),
				true,
				JOHN,
			),
		).toEqual(ok);
		expect(
			await steps.saveSoftware(await load(), ["Power BI", "Microsoft Visio"], true, JOHN),
		).toEqual(ok);
		expect((await load()).step).toBe(4);
	});

	it("changes nothing when Halo fails on Complete replacement, and journals it", async () => {
		vi.stubEnv("MOCK_FAILURES", "halo");
		vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await steps.completeReplacement(await load(), JOHN);
		vi.unstubAllEnvs();
		expect(result).toMatchObject({
			ok: false,
			failure: { connection: "halo", statusCode: 503 },
		});
		const detail = await load();
		expect(detail).toMatchObject({ status: "booked", step: 4 });
		expect(detail.journal[0]).toMatchObject({
			failed: true,
			body: expect.stringContaining("Complete replacement failed"),
		});
	});

	it("completes, returns and decommissions, closing the case", async () => {
		expect(await steps.completeReplacement(await load(), JOHN)).toEqual(ok);
		let detail = await load();
		expect(detail).toMatchObject({ status: "awaiting_return", step: 5 });
		expect(detail.bookings[0].status).toBe("attended");
		expect(
			await queryOne("SELECT outcome FROM lr.device_allocations WHERE case_id = $1", [
				caseId,
			]),
		).toEqual({ outcome: "issued" });
		expect((await stock.availableDevices(JOHN)).map((d) => d.assetId)).not.toContain(box);

		expect(
			await steps.markReturned(await load(), addDays(londonToday(), 1), JOHN),
		).toMatchObject({ ok: false });
		expect(await steps.markReturned(await load(), londonToday(), JOHN)).toEqual(ok);
		detail = await load();
		expect(detail).toMatchObject({ status: "awaiting_decommission", step: 6 });

		const checks = (await steps.getStepData(detail)).decommissionChecks;
		expect(checks.length).toBeGreaterThan(0);
		expect(await steps.decommission(detail, [checks[0].id], JOHN)).toMatchObject({ ok: false });
		expect(
			await steps.decommission(
				await load(),
				checks.map((c) => c.id),
				JOHN,
			),
		).toEqual(ok);
		expect(await load()).toMatchObject({ status: "completed", step: null });
	});
});
