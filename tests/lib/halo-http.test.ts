/**
 * The Halo REST API client against a fake Halo: sign-in, token reuse,
 * GET and POST, errors, and the users client's requests.
 */
import type { CallContext } from "@/lib/clients/connection-log";

const logged: unknown[][] = [];

vi.mock("@/lib/db/query", () => ({
	queryOne: vi.fn(async (sql: string, params: unknown[]) => {
		if (sql.includes("portal.connections")) return { url: "https://halo.example.test/api/" };
		logged.push(params);
		return { id: String(logged.length) };
	}),
}));

const { clearHaloTokens, createHaloHttp } = await import("@/lib/clients/halo/http");
const { createHttpHaloUsersClient } = await import("@/lib/clients/halo/users");

const credentials = { clientId: "portal", clientSecret: "secret", scope: "all" };
const context: CallContext = { trigger: { kind: "system", label: "Test" } };

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const token = () => json({ access_token: "token-1", expires_in: 3600 });

beforeEach(() => {
	logged.length = 0;
	clearHaloTokens();
	vi.unstubAllEnvs();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createHaloHttp", () => {
	it("signs in with client credentials and reuses the token", async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(token())
			.mockResolvedValueOnce(json({ users: [] }))
			.mockResolvedValueOnce(json({ id: 7 }));
		const halo = createHaloHttp({
			siteUrl: "https://halo.example.test/",
			credentials,
			fetchFn,
		});

		await halo.get("/Users", { search: "priya", count: 10, unused: undefined });
		await halo.post("/Asset", [{ id: 7, status_id: 2 }]);

		const [tokenUrl, tokenInit] = fetchFn.mock.calls[0];
		expect(tokenUrl).toBe("https://halo.example.test/auth/token");
		expect(String(tokenInit.body)).toBe(
			"grant_type=client_credentials&client_id=portal&client_secret=secret&scope=all",
		);
		expect(fetchFn.mock.calls[1][0]).toBe(
			"https://halo.example.test/api/Users?search=priya&count=10",
		);
		expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe("Bearer token-1");
		expect(fetchFn.mock.calls[2][1]).toMatchObject({
			method: "POST",
			body: '[{"id":7,"status_id":2}]',
		});
		expect(fetchFn).toHaveBeenCalledTimes(3);
		expect(halo.requests).toEqual(["GET /Users", "POST /Asset"]);
	});

	it("signs in again once when Halo rejects the token", async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(token())
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(json({ access_token: "token-2", expires_in: 3600 }))
			.mockResolvedValueOnce(json({ id: 1 }));
		const halo = createHaloHttp({ siteUrl: "https://halo.example.test", credentials, fetchFn });

		await expect(halo.get("/Users/1")).resolves.toEqual({ id: 1 });
		expect(fetchFn.mock.calls[3][1].headers.Authorization).toBe("Bearer token-2");
	});

	it("explains the rate limit", async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(token())
			.mockResolvedValueOnce(new Response(null, { status: 429 }));
		const halo = createHaloHttp({ siteUrl: "https://halo.example.test", credentials, fetchFn });

		await expect(halo.get("/Asset")).rejects.toMatchObject({
			statusCode: 429,
			message: expect.stringContaining("700 in 5 minutes"),
		});
	});
});

describe("Halo users over HTTP", () => {
	const priya = {
		id: 1002,
		name: "Priya Hart",
		firstname: "Priya",
		emailaddress: "Priya.Hart@bcpcouncil.test",
		login: "priya.hart",
		title: "Planning Officer",
		azureoid: "10000000-0000-4000-8000-000000000002",
		inactive: false,
	};

	it("finds a user by Entra object ID, then reads their department", async () => {
		vi.stubEnv("HALO_CLIENT_ID", "portal");
		vi.stubEnv("HALO_CLIENT_SECRET", "secret");
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(token())
			.mockResolvedValueOnce(json({ users: [priya] }))
			.mockResolvedValueOnce(json({ ...priya, department: "Planning" }));

		const result = await createHttpHaloUsersClient(fetchFn).findByEntraObjectId(
			priya.azureoid,
			context,
		);

		expect(result.value).toEqual({
			haloUserId: 1002,
			entraObjectId: priya.azureoid,
			email: "priya.hart@bcpcouncil.test",
			displayName: "Priya Hart",
			firstName: "Priya",
			username: "priya.hart",
			jobTitle: "Planning Officer",
			department: "Planning",
			active: true,
			manager: null,
		});
		const search = new URL(fetchFn.mock.calls[1][0]).searchParams;
		expect(JSON.parse(search.get("advanced_search") ?? "")).toEqual([
			{ filter_name: "azureoid", filter_type: 2, filter_value: priya.azureoid },
		]);
		expect(fetchFn.mock.calls[2][0]).toBe("https://halo.example.test/api/Users/1002");
		expect(logged[0]?.[0]).toBe("halo");
		expect(logged[0]?.[7]).toBe(
			"Staff details: found Priya Hart (GET /Users, GET /Users/1002)",
		);
	});

	it("needs an exact email match", async () => {
		vi.stubEnv("HALO_CLIENT_ID", "portal");
		vi.stubEnv("HALO_CLIENT_SECRET", "secret");
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(token())
			.mockResolvedValueOnce(
				json({ users: [{ ...priya, emailaddress: "priya.hartley@bcpcouncil.test" }] }),
			);

		const result = await createHttpHaloUsersClient(fetchFn).findByEmail(
			"priya.hart@bcpcouncil.test",
			context,
		);
		expect(result.value).toBeNull();
	});

	it("fails clearly without credentials", async () => {
		await expect(
			createHttpHaloUsersClient(vi.fn()).search("priya", context),
		).rejects.toMatchObject({
			connection: "halo",
			message: "HALO_CLIENT_ID and HALO_CLIENT_SECRET are not set.",
		});
	});
});
