/**
 * Case actions against the local database: a booked case on its own
 * session, then resend (with Power Automate failing), cancel, flag and
 * withdraw. Cleans up as portal_migrator. Skipped without a database.
 */
import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.MIGRATE_DATABASE_URL);
const JOHN = "00000000-0000-4000-8000-000000000001";

describe.skipIf(!hasDatabase)("case actions against the local database", async () => {
	const { getPool } = await import("@/lib/db/pool");
	const { query, queryOne } = await import("@/lib/db/query");
	const { londonToday } = await import("@/lib/clock");
	const { addDays } = await import("@/lib/dates/working-days");
	const { createSession } = await import("@/services/replacements/laptops/lib/sessions");
	const cases = await import("@/services/replacements/laptops/lib/cases");

	let sessionId = "";
	let caseId = "";
	let reference = "";
	const load = async () => {
		const detail = await cases.getCase(reference);
		if (!detail) throw new Error("case not found");
		return detail;
	};

	beforeAll(async () => {
		sessionId = await createSession(
			{
				type: "session",
				date: addDays(londonToday(), 5),
				time: "10:00",
				capacity: 3,
				location: "Test",
			},
			JOHN,
		);
		const row = await queryOne<{ id: string; reference: string }>(
			`INSERT INTO lr.cases (user_id, session_type, status, old_asset_id, old_serial, invited_at, box_number)
			 SELECT id, 'session', 'booked', 'TEST-CASES', 'TESTSERIAL2', now(), 'TESTBOX'
			 FROM portal.users WHERE email = 'kate.morris@bcpcouncil.test'
			 RETURNING id, reference`,
		);
		caseId = row?.id ?? "";
		reference = row?.reference ?? "";
		await query(
			"INSERT INTO lr.device_allocations (box_number, case_id, allocated_by) VALUES ('TESTBOX', $1, $2)",
			[caseId, JOHN],
		);
		await query(
			"INSERT INTO lr.bookings (case_id, session_id, software_requested) VALUES ($1, $2, '{}')",
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
		await admin.end();
		await getPool().end();
	});

	it("offers what a booked case can do", async () => {
		const detail = await load();
		expect(detail.step).toBe(2);
		expect(cases.availableActions(detail)).toEqual([
			"resend-booking",
			"resend-invitation",
			"cancel-booking",
			"withdraw",
		]);
	});

	it("changes nothing when the email fails, but journals the attempt", async () => {
		vi.stubEnv("MOCK_FAILURES", "email_webhook");
		vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await cases.cancelBooking(await load(), JOHN);
		vi.unstubAllEnvs();

		expect(result).toMatchObject({ ok: false, emailFailed: true });
		const detail = await load();
		expect(detail.status).toBe("booked");
		expect(detail.journal[0]).toMatchObject({
			body: "Email not sent: rebook needed to user",
			failed: true,
		});
	});

	it("cancels the booking and keeps the device", async () => {
		expect(await cases.cancelBooking(await load(), JOHN)).toEqual({ ok: true });
		const detail = await load();
		expect(detail).toMatchObject({
			status: "rebook_required",
			boxNumber: "TESTBOX",
			booking: null,
		});
		expect(detail.bookings[0].status).toBe("cancelled");
	});

	it("flags, then withdraws: the flag clears and the box goes back to stock", async () => {
		expect(await cases.flagCase(await load(), "On leave", JOHN)).toEqual({ ok: true });
		expect((await load()).flag?.reason).toBe("On leave");

		expect(await cases.withdrawCase(await load(), "Left the council", JOHN)).toEqual({
			ok: true,
		});
		const detail = await load();
		expect(detail).toMatchObject({
			status: "withdrawn",
			boxNumber: null,
			flag: null,
			withdrawnReason: "Left the council",
		});
		expect(
			await queryOne("SELECT outcome FROM lr.device_allocations WHERE case_id = $1", [
				caseId,
			]),
		).toEqual({ outcome: "case_withdrawn" });
		expect(cases.availableActions(detail)).toEqual([]);
	});
});
