/**
 * Signing in and saving roles against the local database, with the mock
 * Halo users. Uses people the seed has no portal user for, and removes them
 * afterwards. Skipped when DATABASE_URL is not set.
 */
import { existsSync } from "node:fs";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

const hasDatabase = Boolean(process.env.DATABASE_URL);
const JOHN = "00000000-0000-4000-8000-000000000001";
const oid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe.skipIf(!hasDatabase)("signing in and roles against the local database", async () => {
	const { getPool } = await import("@/lib/db/pool");
	const { query, queryOne } = await import("@/lib/db/query");
	const { signInPortalUser } = await import("@/lib/auth/sign-in");
	const { saveUserRoles } = await import("@/lib/portal/users");
	const context = { trigger: { kind: "user" as const, label: "Test", actorUserId: JOHN } };

	const cleanUp = () =>
		query("DELETE FROM portal.users WHERE halo_user_id = ANY($1::int[])", [[9000023, 9000024]]);

	beforeAll(cleanUp);
	afterAll(async () => {
		await cleanUp();
		await getPool().end();
	});

	it("creates a portal user from Halo on first sign-in, and refreshes it after", async () => {
		const first = await signInPortalUser(oid(23));
		expect(first).toMatchObject({ ok: true, roles: [] });

		const row = await queryOne<{
			id: string;
			created_via: string;
			job_title: string;
			signed_in: boolean;
		}>(
			`SELECT id, created_via, job_title, last_signed_in_at IS NOT NULL AS signed_in
			 FROM portal.users WHERE halo_user_id = 9000023`,
		);
		expect(row).toMatchObject({
			created_via: "sign_in",
			job_title: "Environmental Health Officer",
			signed_in: true,
		});

		const again = await signInPortalUser(oid(23));
		expect(again.ok && again.userId).toBe(row?.id);
	});

	it("refuses someone not in Halo or with a disabled account", async () => {
		expect(await signInPortalUser(oid(999))).toEqual({ ok: false, reason: "not_in_halo" });
		expect(await signInPortalUser(oid(25))).toEqual({ ok: false, reason: "account_disabled" });
		const peter = await queryOne("SELECT 1 FROM portal.users WHERE halo_user_id = 9000025");
		expect(peter).toBeUndefined();
	});

	it("creates a portal user when given a role, and keeps the role history", async () => {
		expect(await saveUserRoles(9000024, ["laptops_team"], JOHN, context)).toEqual({
			ok: true,
			name: "Sophie Grant",
		});
		expect(await saveUserRoles(9000024, [], JOHN, context)).toMatchObject({ ok: true });

		const user = await queryOne<{ created_via: string; created_by: string }>(
			"SELECT created_via, created_by FROM portal.users WHERE halo_user_id = 9000024",
		);
		expect(user).toEqual({ created_via: "role_granted", created_by: JOHN });

		const history = await query<{ role: string; change: string; changed_by: string }>(
			`SELECT h.role, h.change, h.changed_by
			 FROM portal.user_role_history h JOIN portal.users u ON u.id = h.user_id
			 WHERE u.halo_user_id = 9000024 ORDER BY h.id`,
		);
		expect(history).toEqual([
			{ role: "laptops_team", change: "added", changed_by: JOHN },
			{ role: "laptops_team", change: "removed", changed_by: JOHN },
		]);
	});

	it("never removes the last Administrator", async () => {
		const admins = await queryOne<{ count: string }>(
			"SELECT count(*) FROM portal.user_roles WHERE role = 'administrator'",
		);
		expect(Number(admins?.count)).toBe(1);
		expect(await saveUserRoles(9000001, ["laptops_team"], JOHN, context)).toEqual({
			ok: false,
			error: "There must be at least one Administrator",
		});
	});
});
