/**
 * Runs Better Auth's real Microsoft sign-in flow against a fake Entra token
 * endpoint, to prove the stateless session carries the Entra object ID.
 */
import { createAuth } from "@/lib/auth/better-auth";

const BASE = "http://localhost:3000";
const OID = "10000000-0000-4000-8000-000000000002";

function unsignedJwt(claims: Record<string, unknown>): string {
	const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.`;
}

function cookiesFrom(response: Response, existing = ""): string {
	const jar = new Map(
		existing
			.split("; ")
			.filter(Boolean)
			.map((pair) => pair.split("=", 2) as [string, string]),
	);
	for (const header of response.headers.getSetCookie()) {
		const [pair] = header.split(";");
		const index = pair.indexOf("=");
		jar.set(pair.slice(0, index), pair.slice(index + 1));
	}
	return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

describe("Better Auth with Entra ID, stateless", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("puts the Entra object ID on the session cookie", async () => {
		const realFetch = globalThis.fetch;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input instanceof Request ? input.url : input);
				if (url.includes("login.microsoftonline.com") && url.endsWith("/token")) {
					return Response.json({
						access_token: "access",
						token_type: "Bearer",
						expires_in: 3600,
						id_token: unsignedJwt({
							oid: OID,
							name: "Priya Hart",
							email: "priya.hart@bcpcouncil.test",
							tid: "tenant",
						}),
					});
				}
				return realFetch(input, init);
			}),
		);

		const auth = createAuth({
			secret: "a-test-secret-that-is-long-enough-for-better-auth-0123456789",
			baseURL: BASE,
			entra: { clientId: "client", clientSecret: "secret", tenantId: "tenant" },
		});

		const start = await auth.handler(
			new Request(`${BASE}/api/auth/sign-in/social`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Origin: BASE },
				body: JSON.stringify({ provider: "microsoft", callbackURL: "/auth/complete" }),
			}),
		);
		const { url } = (await start.json()) as { url: string };
		const authorize = new URL(url);
		expect(authorize.origin).toBe("https://login.microsoftonline.com");
		expect(authorize.searchParams.get("scope")).toBe("openid profile email");
		let cookies = cookiesFrom(start);

		const callback = await auth.handler(
			new Request(
				`${BASE}/api/auth/callback/microsoft?code=code&state=${authorize.searchParams.get("state")}`,
				{ headers: { Cookie: cookies } },
			),
		);
		expect(callback.headers.get("location")).toBe("/auth/complete");
		cookies = cookiesFrom(callback, cookies);

		const session = await auth.api.getSession({ headers: new Headers({ Cookie: cookies }) });
		expect(session?.user).toMatchObject({ entraObjectId: OID, name: "Priya Hart" });

		// A fresh instance (a restart, or another App Service instance) has
		// nothing in memory, so the ID must come from the cookie.
		const fresh = createAuth({
			secret: "a-test-secret-that-is-long-enough-for-better-auth-0123456789",
			baseURL: BASE,
			entra: { clientId: "client", clientSecret: "secret", tenantId: "tenant" },
		});
		const again = await fresh.api.getSession({ headers: new Headers({ Cookie: cookies }) });
		expect(again?.user.entraObjectId).toBe(OID);
	});

	it("has no session without the cookies", async () => {
		const auth = createAuth({
			secret: "a-test-secret-that-is-long-enough-for-better-auth-0123456789",
			baseURL: BASE,
			entra: null,
		});
		expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
	});
});
