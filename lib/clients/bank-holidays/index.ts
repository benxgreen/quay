import "server-only";

import type { IsoDate } from "@/lib/dates/working-days";
import { createGovUkBankHolidaysClient } from "./http";
import { createMockBankHolidaysClient } from "./mock";

/** England and Wales bank holidays, from the GOV.UK feed. */
export type BankHolidaysClient = {
	/** Every England and Wales bank holiday the feed lists, as YYYY-MM-DD. */
	englandAndWales(): Promise<IsoDate[]>;
};

let client: BankHolidaysClient | undefined;

/**
 * The bank holidays client for the app. Set BANK_HOLIDAYS_SOURCE=mock to work
 * offline with the dates in BANK_HOLIDAYS_MOCK (comma-separated).
 */
export function getBankHolidaysClient(): BankHolidaysClient {
	if (!client) {
		client =
			process.env.BANK_HOLIDAYS_SOURCE === "mock"
				? createMockBankHolidaysClient(
						(process.env.BANK_HOLIDAYS_MOCK ?? "").split(",").filter(Boolean),
					)
				: createGovUkBankHolidaysClient();
	}
	return client;
}
