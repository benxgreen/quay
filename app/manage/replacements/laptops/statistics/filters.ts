import type { IsoDate } from "@/lib/dates/working-days";
import {
	parseStatisticsFilters,
	type StatisticsFilters,
} from "@/services/replacements/laptops/lib/statistics";

type Params = Record<string, string | undefined>;

/** Day, month and year boxes ("from-day" and so on) as YYYY-MM-DD, or "" when blank. */
function dateFrom(params: Params, name: string): string {
	const [day, month, year] = ["day", "month", "year"].map((part) =>
		(params[`${name}-${part}`] ?? "").trim(),
	);
	if (!day && !month && !year) return params[name] ?? "";
	return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** The page's filters from its address, the same for the page and the CSV. */
export function readFilters(params: Params, today: IsoDate): StatisticsFilters {
	return parseStatisticsFilters(
		{ ...params, from: dateFrom(params, "from"), to: dateFrom(params, "to") },
		today,
	);
}

/** The query string for the same figures, such as for the CSV link. */
export function filtersQuery(filters: StatisticsFilters): string {
	const params = new URLSearchParams({ period: filters.period });
	if (filters.type) params.set("type", filters.type);
	if (filters.period === "custom" && !filters.error) {
		params.set("from", filters.from);
		params.set("to", filters.to);
	}
	return params.toString();
}
