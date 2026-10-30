/**
 * Sessions against the local database: adding, listing and cancelling one
 * while Power Automate is failing. Makes its own session and case, and
 * removes them afterwards as portal_migrator (the app can't delete cases
 * or journal entries). Skipped when DATABASE_URL is not set.
 */
import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.MIGRATE_DATABASE_URL);
const ALEX = "00000000-0000-4000-8000-000000000003";

describe.skipIf(!hasDatabase)("sessions against the local database", async () => {
	const { getPool } = await import("@/lib/db/pool");
	const { query, queryOne } = await import("@/lib/db/query");
	const { londonToday } = await import("@/lib/clock");
	const { addDays } = await import("@/lib/dates/working-days");
	const sessions = await import("@/services/replacements/laptops/lib/sessions");

	const date = addDays(londonToday(), 3);
	let sessionId = "";
	let caseId = "";

	beforeAll(async () => {
		sessionId = await sessions.createSession(
			{ type: "collection", date, time: "13:15", capacity: 2, location: "Test room" },
			ALEX,
		);
		const created = await queryOne<{ id: string }>(
			`INSERT INTO lr.cases (user_id, session_type, status, old_asset_id, old_serial, invited_at)
			 SELECT id, 'collection', 'booked', 'TEST-SESSIONS', 'TESTSERIAL', now()
			 FROM portal.users WHERE email = 'ellie.ward@bcpcouncil.test'
			 RETURNING id`,
		);
		caseId = created?.id ?? "";
		await query(
			"INSERT INTO lr.bookings (case_id, session_id, software_requested) VALUES ($1, $2, '{Power BI}')",
			[caseId, sessionId],
		);
	});

	afterAll(async () => {
		const admin = new pg.Client({ connectionString: process.env.MIGRATE_DATABASE_URL });
		await admin.connect();
		await admin.query("DELETE FROM lr.email_sends WHERE case_id = $1", [caseId]);
		await admin.query("DELETE FROM lr.cases WHERE id = $1", [caseId]);
		await admin.query("DELETE FROM lr.sessions WHERE id = $1", [sessionId]);
		await admin.end();
		await getPool().end();
	});

	it("lists the new session in London time with its booking", async () => {
		const { sessions: list, months } = await sessions.listSessions(
			{ show: "upcoming", month: "", type: "collection", status: "open" },
			londonToday(),
		);
		expect(list.find((session) => session.id === sessionId)).toMatchObject({
			date,
			time: "13:15",
			booked: 1,
			status: "open",
		});
		expect(months).toContain(date.slice(0, 7));
	});

	it("rejects another session of the same type at the same time", async () => {
		await expect(
			sessions.createSession(
				{ type: "collection", date, time: "13:15", capacity: 2, location: "Another room" },
				ALEX,
			),
		).rejects.toMatchObject({ constraint: "sessions_one_per_type_and_time" });
	});

	it("cancels it: the case needs a rebook, and a failed email is journaled and listed", async () => {
		vi.stubEnv("MOCK_FAILURES", "email_webhook");
		vi.spyOn(console, "error").mockImplementation(() => {});
		await query("UPDATE lr.cases SET reminders_sent = 2 WHERE id = $1", [caseId]);

		const result = await sessions.cancelSession(sessionId, "Test room flooded", ALEX);
		vi.unstubAllEnvs();

		expect(result).toMatchObject({ cancelled: 1, notEmailed: [{ name: "Ellie Ward" }] });
		expect(
			await queryOne("SELECT status, reminders_sent FROM lr.cases WHERE id = $1", [caseId]),
		).toEqual({ status: "rebook_required", reminders_sent: 0 });

		const journal = await query<{ body: string; outcome: string }>(
			"SELECT body, outcome FROM lr.journal_entries WHERE case_id = $1 ORDER BY id",
			[caseId],
		);
		expect(journal).toEqual([
			{ body: "Session cancelled: Test room flooded", outcome: "success" },
			{ body: "Email not sent: session cancelled to user", outcome: "failed" },
		]);

		const detail = await sessions.getSession(sessionId);
		expect(detail).toMatchObject({
			status: "cancelled",
			booked: 0,
			cancelled: { reason: "Test room flooded", by: "Alex Morgan" },
			cancelledAttendees: [
				{ name: "Ellie Ward", emailFailed: true, caseStatus: "rebook_required" },
			],
		});
		expect(await sessions.cancelSession(sessionId, "", ALEX)).toBeNull();
	});
});
