import {
	BankHolidaysUnavailableError,
	createGovUkBankHolidaysClient,
} from "@/lib/clients/bank-holidays/http";

const FEED = {
	"england-and-wales": { events: [{ date: "2026-12-25" }, { date: "2026-12-28" }] },
	scotland: { events: [{ date: "2026-11-30" }] },
};

function fakeFetch(responses: Array<() => Response>) {
	const fetchFn = vi.fn(async () => {
		const next = responses.shift();
		if (!next) throw new Error("no more responses");
		return next();
	});
	return fetchFn as unknown as typeof fetch & typeof fetchFn;
}

describe("GOV.UK bank holidays client", () => {
	it("returns England and Wales dates only and caches them for a day", async () => {
		let now = 0;
		const fetchFn = fakeFetch([() => Response.json(FEED)]);
		const client = createGovUkBankHolidaysClient(fetchFn, () => now);

		expect(await client.englandAndWales()).toEqual(["2026-12-25", "2026-12-28"]);
		now = 23 * 60 * 60 * 1000;
		await client.englandAndWales();
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it("keeps the last good copy when a refresh fails", async () => {
		let now = 0;
		const fetchFn = fakeFetch([
			() => Response.json(FEED),
			() => new Response("down", { status: 503 }),
		]);
		const client = createGovUkBankHolidaysClient(fetchFn, () => now);

		await client.englandAndWales();
		now = 25 * 60 * 60 * 1000;
		expect(await client.englandAndWales()).toEqual(["2026-12-25", "2026-12-28"]);
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	it("throws when there is no copy at all", async () => {
		const client = createGovUkBankHolidaysClient(
			fakeFetch([() => new Response("down", { status: 503 })]),
		);

		await expect(client.englandAndWales()).rejects.toBeInstanceOf(BankHolidaysUnavailableError);
	});
});
