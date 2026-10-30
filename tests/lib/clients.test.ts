/**
 * The clients, the connection logger and the external-calls-first rule,
 * with the database replaced by a recorder.
 */
import type { CallContext } from "@/lib/clients/connection-log";

const logged: unknown[][] = [];
const saved: string[] = [];

vi.mock("@/lib/db/query", () => ({
	queryOne: vi.fn(async (_sql: string, params: unknown[]) => {
		logged.push(params);
		return { id: String(logged.length) };
	}),
}));

vi.mock("@/lib/db/transaction", () => ({
	withTransaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
}));

const { callExternal, ExternalCallError, HttpStatusError } = await import(
	"@/lib/clients/connection-log"
);
const { createMockEmailClient, mockOutbox } = await import("@/lib/clients/email");
const { createMockHaloUsersClient } = await import("@/lib/clients/halo/users");
const { createMockLaptopHaloClient } = await import(
	"@/services/replacements/laptops/lib/halo/mock"
);
const { postJsonWebhook, validateWebhookUrl } = await import("@/lib/clients/webhook");
const { externalFirst, SaveAfterCallError } = await import("@/lib/external-first");

const context: CallContext = {
	trigger: { kind: "user", label: "Complete replacement", actorUserId: "user-1" },
	caseId: 128,
};

beforeEach(() => {
	logged.length = 0;
	saved.length = 0;
	vi.unstubAllEnvs();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("callExternal", () => {
	it("logs a successful call with its status and summary", async () => {
		const result = await callExternal("halo", context, async () => ({
			value: 5,
			statusCode: 200,
			summary: "5 devices",
		}));

		expect(result).toEqual({ value: 5, connection: "halo", logId: 1 });
		expect(logged[0]).toEqual([
			"halo",
			"user",
			"Complete replacement",
			"user-1",
			128,
			"success",
			200,
			"5 devices",
			null,
			expect.any(Number),
		]);
	});

	it("logs a failure and throws what the Failed banner needs", async () => {
		const error = await callExternal("halo", context, async () => {
			throw new HttpStatusError(503, "Halo returned 503 Service Unavailable");
		}).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ExternalCallError);
		expect(error).toMatchObject({
			connection: "halo",
			statusCode: 503,
			timedOut: false,
			logId: 1,
			message: "Halo returned 503 Service Unavailable",
		});
		expect(logged[0]?.[5]).toBe("failed");
	});

	it("gives up after the timeout", async () => {
		const error = await callExternal(
			"halo",
			context,
			(signal) =>
				new Promise<never>((_, reject) => {
					signal.addEventListener("abort", () => reject(signal.reason));
				}),
			{ timeoutMs: 20 },
		).catch((e: unknown) => e);

		expect(error).toMatchObject({ timedOut: true, message: "No response within 0 seconds" });
	});
});

describe("postJsonWebhook", () => {
	const url =
		"https://prod-00.uksouth.logic.azure.com/workflows/abc/triggers/manual/paths/invoke";
	const sleep = vi.fn(async () => {});

	it("retries twice with backoff, then succeeds", async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 502 }))
			.mockRejectedValueOnce(new TypeError("fetch failed"))
			.mockResolvedValueOnce(new Response(null, { status: 202 }));

		await expect(postJsonWebhook(url, { a: 1 }, { fetchFn, sleep })).resolves.toBe(202);
		expect(fetchFn).toHaveBeenCalledTimes(3);
		expect(sleep.mock.calls).toEqual([[1000], [2000]]);
	});

	it("throws the last failure when every attempt fails", async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
		await expect(postJsonWebhook(url, {}, { fetchFn, sleep })).rejects.toMatchObject({
			statusCode: 500,
		});
		expect(fetchFn).toHaveBeenCalledTimes(3);
	});

	it("refuses local and private addresses", () => {
		expect(() => validateWebhookUrl("http://localhost:7071/hook")).toThrow();
		expect(() => validateWebhookUrl("https://10.0.0.5/hook")).toThrow();
	});
});

describe("mock clients", () => {
	const message = {
		template: "session_cancelled",
		service: "laptop_replacements",
		case: "LR-000128",
		to: "ellie.ward@bcpcouncil.test",
		from_name: "Desktop Infrastructure",
		from: "desktopinfrastructure@bcpcouncil.gov.uk",
		subject: "Cancelled",
		preheader: "",
		html: "<p>Hi</p>",
		text: "Hi",
	};

	it("keeps sent emails in the outbox", async () => {
		const before = mockOutbox().length;
		await createMockEmailClient().send(message, context);
		expect(mockOutbox()).toHaveLength(before + 1);
		expect(logged[0]?.[0]).toBe("email_webhook");
	});

	it("fails a connection named in MOCK_FAILURES", async () => {
		vi.stubEnv("MOCK_FAILURES", "halo, email_webhook");
		await expect(createMockEmailClient().send(message, context)).rejects.toMatchObject({
			statusCode: 502,
		});
		await expect(createMockLaptopHaloClient().listStock(context)).rejects.toMatchObject({
			connection: "halo",
			statusCode: 503,
		});
	});

	it("takes an issued device out of the mock stock", async () => {
		const halo = createMockLaptopHaloClient();
		const assetIds = async () => (await halo.listStock(context)).value.map((d) => d.assetId);
		expect(await assetIds()).toContain("45856");

		await halo.issueDevice(
			{
				assetId: "45856",
				personName: "Ellie Ward",
				reference: "LR-000128",
				date: "2026-11-17",
			},
			context,
		);
		expect(await assetIds()).not.toContain("45856");
	});
});

describe("Halo staff details", () => {
	const users = createMockHaloUsersClient();

	it("matches a signed-in user by their Entra object ID", async () => {
		const { value } = await users.findByEntraObjectId(
			"10000000-0000-4000-8000-000000000002",
			context,
		);
		expect(value).toMatchObject({
			haloUserId: 1002,
			displayName: "Priya Hart",
			jobTitle: "Planning Officer",
		});
		expect(logged[0]?.[0]).toBe("halo");
	});

	it("finds people by email and by search, including disabled accounts", async () => {
		expect(
			(await users.findByEmail("Peter.Long@bcpcouncil.test ", context)).value,
		).toMatchObject({
			active: false,
		});
		expect((await users.search("price", context)).value.map((u) => u.displayName)).toEqual([
			"Owen Price",
			"Hannah Price",
		]);
	});
});

describe("externalFirst", () => {
	const halo = createMockLaptopHaloClient();
	const save = async () => {
		saved.push("saved");
		return "done";
	};

	it("saves only after the call succeeds", async () => {
		const result = await externalFirst({
			call: () => halo.listStock(context),
			save,
		});
		expect(result).toEqual({ ok: true, value: "done" });
		expect(saved).toEqual(["saved"]);
	});

	it("changes nothing but records the failed attempt when the call fails", async () => {
		vi.stubEnv("MOCK_FAILURES", "halo");
		const recorded: unknown[] = [];
		const result = await externalFirst({
			call: () => halo.listStock(context),
			save,
			recordFailure: async (failure) => recorded.push(failure),
		});

		expect(result).toMatchObject({
			ok: false,
			failure: { connection: "halo", statusCode: 503, logId: 1 },
		});
		expect(saved).toEqual([]);
		expect(recorded).toEqual([
			expect.objectContaining({ connection: "halo", statusCode: 503 }),
		]);
	});

	it("still returns the failure when recording it fails", async () => {
		vi.stubEnv("MOCK_FAILURES", "halo");
		const result = await externalFirst({
			call: () => halo.listStock(context),
			save,
			recordFailure: async () => {
				throw new Error("database down");
			},
		});
		expect(result.ok).toBe(false);
	});

	it("says loudly when saving fails after the call succeeded", async () => {
		await expect(
			externalFirst({
				call: () => halo.listStock(context),
				save: async () => {
					throw new Error("lr_cases_status_check");
				},
			}),
		).rejects.toBeInstanceOf(SaveAfterCallError);
	});
});
