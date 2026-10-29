import type { IsoDate } from "@/lib/dates/working-days";
import type { BankHolidaysClient } from "./index";

/** A bank holidays client that returns the dates it is given, for tests and offline work. */
export function createMockBankHolidaysClient(dates: IsoDate[]): BankHolidaysClient {
	return {
		async englandAndWales() {
			return [...dates];
		},
	};
}
