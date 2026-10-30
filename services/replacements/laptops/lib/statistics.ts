import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { addDays, assertIsoDate, type IsoDate } from "@/lib/dates/working-days";
import { query, queryOne } from "@/lib/db/query";
import { listSoftware } from "@/services/replacements/laptops/lib/settings";
import { getStockSnapshot, listStock } from "@/services/replacements/laptops/lib/stock";

/**
 * Statistics (spec, "Statistics"): figures for a period and type, from the
 * portal's bookings and cases, apart from stock, which is the latest Halo
 * stock list.
 */

export type StatisticsPeriod = "30d" | "3m" | "12m" | "custom";

export type StatisticsFilters = {
	period: StatisticsPeriod;
	type: ReplacementType | "";
	/** Inclusive London dates. */
	from: IsoDate;
	to: IsoDate;
	/** Custom dates as typed, for the form. */
	custom: { from: string; to: string };
	/** Set when custom dates were wrong; the default period is used instead. */
	error?: string;
};

const LONDON = "'Europe/London'";
/** Bookings that stood: not moved to another date or cancelled. */
const COUNTED = "('booked', 'attended', 'did_not_attend', 'unsuccessful')";

function monthsBefore(day: IsoDate, months: number): IsoDate {
	const [year, month, date] = day.split("-").map(Number);
	const index = year * 12 + (month - 1) - months;
	const y = Math.floor(index / 12);
	const m = (index % 12) + 1;
	const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(Math.min(date, last)).padStart(2, "0")}`;
}

export function parseStatisticsFilters(
	params: Record<string, string | undefined>,
	today: IsoDate,
): StatisticsFilters {
	const type = params.type === "collection" || params.type === "session" ? params.type : "";
	const custom = { from: params.from ?? "", to: params.to ?? "" };
	const period =
		(["30d", "3m", "12m", "custom"] as const).find((p) => p === params.period) ?? "3m";
	if (period === "custom") {
		try {
			const from = assertIsoDate(custom.from);
			const to = assertIsoDate(custom.to);
			if (from > to) throw new Error("order");
			return { period, type, from, to, custom };
		} catch {
			return {
				period,
				type,
				from: monthsBefore(today, 3),
				to: today,
				custom,
				error: "Enter real dates, with the start before the end, to see custom dates",
			};
		}
	}
	const from =
		period === "30d" ? addDays(today, -30) : monthsBefore(today, period === "12m" ? 12 : 3);
	return { period, type, from, to: today, custom };
}

export type SessionsByType = {
	type: ReplacementType;
	held: number;
	offered: number;
	booked: number;
	didNotAttend: number;
};

export type Statistics = {
	stock: { available: number; allocated: number } | null;
	sessionsHeld: number;
	replacementsCompleted: number;
	awaitingReturn: number;
	bookings: number;
	software: {
		listed: { name: string; count: number }[];
		typed: { name: string; count: number }[];
	};
	/** Bookings by ISO weekday, Monday (1) to Friday (5). */
	weekdays: { weekday: number; count: number }[];
	sessions: SessionsByType[];
};

export async function getStatistics(filters: StatisticsFilters): Promise<Statistics> {
	const range = [filters.from, filters.to, filters.type];
	const bookingDay = `(coalesce(se.starts_at, b.custom_starts_at) AT TIME ZONE ${LONDON})::date`;
	const bookingsInPeriod = `
		FROM lr.bookings b
		JOIN lr.cases c ON c.id = b.case_id
		LEFT JOIN lr.sessions se ON se.id = b.session_id
		WHERE b.status IN ${COUNTED}
		  AND ${bookingDay} BETWEEN $1::date AND $2::date
		  AND ($3 = '' OR c.session_type = $3)`;

	const [snapshot, figures, software, weekdays, sessions, list] = await Promise.all([
		getStockSnapshot(),
		queryOne<{ completed: number; awaiting: number; bookings: number }>(
			`SELECT
			   (SELECT count(*)::integer FROM lr.cases
			    WHERE status = 'completed' AND (closed_at AT TIME ZONE ${LONDON})::date BETWEEN $1::date AND $2::date
			      AND ($3 = '' OR session_type = $3)) AS completed,
			   (SELECT count(*)::integer FROM lr.cases
			    WHERE status = 'awaiting_return' AND ($3 = '' OR session_type = $3)) AS awaiting,
			   (SELECT count(*)::integer ${bookingsInPeriod}) AS bookings`,
			range,
		),
		query<{ name: string; count: number }>(
			`SELECT name, count(*)::integer AS count
			 FROM (SELECT unnest(b.software_requested) AS name ${bookingsInPeriod}) s
			 GROUP BY name ORDER BY count DESC, lower(name)`,
			range,
		),
		query<{ weekday: number; count: number }>(
			`SELECT extract(isodow FROM ${bookingDay})::integer AS weekday, count(*)::integer AS count
			 ${bookingsInPeriod}
			 GROUP BY 1`,
			range,
		),
		query<SessionsByType>(
			`SELECT s.session_type AS type, count(*)::integer AS held,
			        sum(s.capacity)::integer AS offered,
			        coalesce(sum(n.booked), 0)::integer AS booked,
			        coalesce(sum(n.dna), 0)::integer AS "didNotAttend"
			 FROM lr.sessions s
			 LEFT JOIN LATERAL (
			   SELECT count(*) FILTER (WHERE b.status IN ${COUNTED}) AS booked,
			          count(*) FILTER (WHERE b.status = 'did_not_attend') AS dna
			   FROM lr.bookings b WHERE b.session_id = s.id
			 ) n ON true
			 WHERE s.status <> 'cancelled' AND s.starts_at < now()
			   AND (s.starts_at AT TIME ZONE ${LONDON})::date BETWEEN $1::date AND $2::date
			   AND ($3 = '' OR s.session_type = $3)
			 GROUP BY s.session_type ORDER BY s.session_type`,
			range,
		),
		listSoftware(),
	]);

	let stock: Statistics["stock"] = null;
	if (snapshot) {
		const rows = await listStock(snapshot, {
			search: "",
			status: "",
			model: "",
			location: "",
			issued: false,
		});
		stock = {
			available: rows.filter((row) => row.status === "available").length,
			allocated: rows.filter((row) => row.status === "allocated").length,
		};
	}

	const known = new Set(list.map((item) => item.name.toLowerCase()));
	return {
		stock,
		sessionsHeld: sessions.reduce((sum, row) => sum + row.held, 0),
		replacementsCompleted: figures?.completed ?? 0,
		awaitingReturn: figures?.awaiting ?? 0,
		bookings: figures?.bookings ?? 0,
		software: {
			listed: software.filter((row) => known.has(row.name.toLowerCase())),
			typed: software.filter((row) => !known.has(row.name.toLowerCase())),
		},
		weekdays: [1, 2, 3, 4, 5].map((weekday) => ({
			weekday,
			count: weekdays.find((row) => row.weekday === weekday)?.count ?? 0,
		})),
		sessions,
	};
}
