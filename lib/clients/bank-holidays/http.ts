import type { IsoDate } from "@/lib/dates/working-days";
import type { BankHolidaysClient } from "./index";

const FEED_URL = "https://www.gov.uk/bank-holidays.json";
const CACHE_FOR_MS = 24 * 60 * 60 * 1000;

type Feed = {
	"england-and-wales"?: { events?: Array<{ date?: unknown }> };
};

export class BankHolidaysUnavailableError extends Error {
	constructor(cause: unknown) {
		super("The GOV.UK bank holidays feed could not be read and there is no cached copy", {
			cause,
		});
		this.name = "BankHolidaysUnavailableError";
	}
}

/**
 * Reads the GOV.UK feed and caches it for a day. If a refresh fails it keeps
 * using the last good copy; with no copy at all it throws, so a job stops
 * rather than working out dates without bank holidays.
 */
export function createGovUkBankHolidaysClient(
	fetchFeed: typeof fetch = fetch,
	now: () => number = Date.now,
): BankHolidaysClient {
	let cached: { dates: IsoDate[]; at: number } | undefined;

	return {
		async englandAndWales() {
			if (cached && now() - cached.at < CACHE_FOR_MS) {
				return cached.dates;
			}
			try {
				const response = await fetchFeed(FEED_URL, {
					headers: { accept: "application/json" },
					signal: AbortSignal.timeout(10_000),
				});
				if (!response.ok) {
					throw new Error(`GOV.UK returned ${response.status}`);
				}
				const feed = (await response.json()) as Feed;
				const dates = (feed["england-and-wales"]?.events ?? [])
					.map((event) => event.date)
					.filter(
						(date): date is string =>
							typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date),
					);
				if (dates.length === 0) {
					throw new Error("The feed had no England and Wales dates");
				}
				cached = { dates, at: now() };
				return dates;
			} catch (error) {
				if (cached) {
					return cached.dates;
				}
				throw new BankHolidaysUnavailableError(error);
			}
		},
	};
}
