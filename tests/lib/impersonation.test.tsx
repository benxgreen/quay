import { render, screen } from "@testing-library/react";
import { ImpersonationBanner } from "@/components/patterns/impersonation-banner";
import {
	IMPERSONATION_COOKIE,
	IMPERSONATION_MAX_AGE_SECONDS,
	readImpersonation,
	signImpersonation,
} from "@/lib/auth/impersonation";
import {
	canImpersonate,
	describeRoles,
	impersonationFor,
	STOP_IMPERSONATING_HREF,
} from "@/lib/portal/impersonation";
import { axeViolations } from "@/tests/axe";

const ADMIN = "00000000-0000-4000-8000-000000000001";
const PRIYA = "00000000-0000-4000-8000-000000000002";
const OTHER = "00000000-0000-4000-8000-000000000003";

const cookieJar = new Map<string, string>();
let signedIn: string | null = null;
const users: Record<string, { entra: string; name: string; roles: string[] }> = {
	[ADMIN]: { entra: "entra-admin", name: "John Smith", roles: ["administrator"] },
	[PRIYA]: { entra: "entra-priya", name: "Priya Hart", roles: [] },
	[OTHER]: { entra: "entra-other", name: "Sam Lee", roles: ["laptops_team"] },
};

vi.mock("react", async (original) => ({
	...(await original<typeof import("react")>()),
	cache: <T,>(fn: T) => fn,
}));
vi.mock("next/headers", () => ({
	cookies: async () => ({ get: (name: string) => ({ value: cookieJar.get(name) }) }),
}));
vi.mock("@/lib/auth/session", () => ({ getSignedInObjectId: async () => signedIn }));
vi.mock("@/lib/db/query", () => ({
	query: vi.fn(),
	queryOne: async (_sql: string, [key]: [string]) => {
		const entry = Object.entries(users).find(([id, u]) => u.entra === key || id === key);
		if (!entry) return null;
		const [id, u] = entry;
		return {
			id,
			entra_object_id: u.entra,
			display_name: u.name,
			email: `${u.name}@example.test`,
			username: null,
			job_title: null,
			department: null,
			roles: u.roles,
		};
	},
}));

const { getCurrentUser } = await import("@/lib/auth/current-user");

beforeEach(() => {
	process.env.BETTER_AUTH_SECRET ??= "test-secret";
	cookieJar.clear();
	signedIn = null;
	users[ADMIN].roles = ["administrator"];
});

describe("the impersonation cookie", () => {
	it("reads back who is impersonating whom", () => {
		const token = signImpersonation(ADMIN, PRIYA);
		expect(readImpersonation(token)).toMatchObject({ adminUserId: ADMIN, userId: PRIYA });
	});

	it("refuses a forged, altered or expired cookie", () => {
		const token = signImpersonation(ADMIN, PRIYA, new Date("2026-10-31T09:00:00Z"));
		expect(readImpersonation(token.replace(PRIYA, OTHER))).toBeNull();
		expect(readImpersonation(`${token.slice(0, -1)}x`)).toBeNull();
		expect(readImpersonation(undefined)).toBeNull();
		const later = new Date(
			new Date("2026-10-31T09:00:00Z").getTime() + (IMPERSONATION_MAX_AGE_SECONDS + 1) * 1000,
		);
		expect(readImpersonation(token, later)).toBeNull();
	});
});

describe("getCurrentUser while impersonating", () => {
	it("is the impersonated person with their roles, with the Administrator as actor", async () => {
		signedIn = "entra-admin";
		cookieJar.set(IMPERSONATION_COOKIE, signImpersonation(ADMIN, PRIYA));
		const user = await getCurrentUser();
		expect(user).toMatchObject({
			id: PRIYA,
			displayName: "Priya Hart",
			roles: [],
			actorId: ADMIN,
			impersonator: { id: ADMIN, displayName: "John Smith" },
		});
	});

	it("is ignored once the Administrator loses the role", async () => {
		signedIn = "entra-admin";
		users[ADMIN].roles = ["laptops_team"];
		cookieJar.set(IMPERSONATION_COOKIE, signImpersonation(ADMIN, PRIYA));
		expect(await getCurrentUser()).toMatchObject({
			id: ADMIN,
			actorId: ADMIN,
			impersonator: null,
		});
	});

	it("is ignored when someone else presents the cookie", async () => {
		signedIn = "entra-other";
		cookieJar.set(IMPERSONATION_COOKIE, signImpersonation(ADMIN, PRIYA));
		expect(await getCurrentUser()).toMatchObject({ id: OTHER, impersonator: null });
	});
});

describe("who can impersonate", () => {
	const admin = { id: ADMIN, roles: ["administrator"] as const };
	it("is an Administrator, not already impersonating, and never themselves", () => {
		expect(canImpersonate(admin, admin, PRIYA)).toBe(true);
		expect(canImpersonate(admin, admin, ADMIN)).toBe(false);
		expect(canImpersonate(admin, { id: OTHER, roles: ["administrator"] }, PRIYA)).toBe(false);
		expect(
			canImpersonate(
				{ id: OTHER, roles: ["laptops_admin"] },
				{ id: OTHER, roles: [] },
				PRIYA,
			),
		).toBe(false);
	});
});

describe("ImpersonationBanner", () => {
	it("says who and with which roles, with a link to stop", async () => {
		const impersonation = impersonationFor({
			displayName: "Priya Hart",
			roles: [],
			impersonator: { id: ADMIN },
		});
		expect(impersonation).not.toBeNull();
		const { container } = render(
			<ImpersonationBanner
				impersonation={impersonation as NonNullable<typeof impersonation>}
			/>,
		);
		expect(
			screen.getByText(
				/You are currently impersonating Priya Hart\. They have the roles of Colleague \(no role\)\./,
			),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Stop impersonating" })).toHaveAttribute(
			"href",
			STOP_IMPERSONATING_HREF,
		);
		expect(await axeViolations(container)).toEqual([]);
	});

	it("lists roles by their names", () => {
		expect(describeRoles(["administrator", "laptops_team"])).toBe(
			"Administrator, Laptop replacements team",
		);
		expect(impersonationFor({ displayName: "x", roles: [], impersonator: null })).toBeNull();
	});
});
