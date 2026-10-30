import type { Metadata } from "next";
import { FilterGrid, FilterPanel } from "@/components/patterns/filter-panel";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { BarList, ColumnChart } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Details } from "@/components/ui/details";
import { ErrorSummary } from "@/components/ui/error-summary";
import { PageHeading } from "@/components/ui/page-heading";
import { Select } from "@/components/ui/select";
import { StatTiles } from "@/components/ui/stat-tiles";
import { Table } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { londonToday } from "@/lib/clock";
import { formatLongDate } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import { getStatistics } from "@/services/replacements/laptops/lib/statistics";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { filtersQuery, readFilters } from "./filters";

export const metadata: Metadata = { title: "Statistics" };

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function percent(part: number, whole: number): string {
	return whole ? `${Math.round((part / whole) * 100)}%` : "–";
}

/** Mockups: AdminStats. */
export default async function StatisticsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	await requireRole(ACCESS.laptops);
	const today = londonToday();
	const filters = readFilters(await searchParams, today);
	const stats = await getStatistics(filters);
	const [fromYear, fromMonth, fromDay] = filters.custom.from.split("-");
	const [toYear, toMonth, toDay] = filters.custom.to.split("-");
	const collections = stats.sessions.find((row) => row.type === "collection")?.held ?? 0;
	const typedTotal = stats.software.typed.reduce((sum, row) => sum + row.count, 0);
	const totals = stats.sessions.reduce(
		(sum, row) => ({
			held: sum.held + row.held,
			offered: sum.offered + row.offered,
			booked: sum.booked + row.booked,
			didNotAttend: sum.didNotAttend + row.didNotAttend,
		}),
		{ held: 0, offered: 0, booked: 0, didNotAttend: 0 },
	);

	return (
		<LaptopsPage section="statistics">
			<ErrorSummary
				errors={filters.error ? [{ fieldId: "from-day", text: filters.error }] : []}
			/>
			<PageHeading title="Statistics" />

			<FilterPanel
				actions={
					<Button
						variant="secondary"
						href={`${LAPTOPS_SECTIONS.statistics.href}/csv?${filtersQuery(filters)}`}
					>
						Download as CSV
					</Button>
				}
				clearHref={LAPTOPS_SECTIONS.statistics.href}
				defaultOpen={filters.period === "custom" || Boolean(filters.error)}
			>
				<FilterGrid>
					<Select
						id="period"
						name="period"
						label="Period"
						defaultValue={filters.period}
						options={[
							{ value: "30d", label: "Last 30 days" },
							{ value: "3m", label: "Last 3 months" },
							{ value: "12m", label: "Last 12 months" },
							{ value: "custom", label: "Custom dates" },
						]}
					/>
					<Select
						id="type"
						name="type"
						label="Type"
						defaultValue={filters.type}
						options={[
							{ value: "", label: "All types" },
							{ value: "collection", label: "Collection" },
							{ value: "session", label: "Session" },
						]}
					/>
				</FilterGrid>
				<FilterGrid>
					<DateInput
						name="from"
						legend="From"
						legendSize="s"
						hint="Custom dates only"
						error={filters.error}
						value={{ day: fromDay, month: fromMonth, year: fromYear }}
					/>
					<DateInput
						name="to"
						legend="To"
						legendSize="s"
						hint="Custom dates only"
						value={{ day: toDay, month: toMonth, year: toYear }}
					/>
				</FilterGrid>
			</FilterPanel>
			<p>
				Showing {formatLongDate(filters.from, { year: true })} to{" "}
				{formatLongDate(filters.to, { year: true })}
				{filters.type ? `, ${filters.type}s only` : ""}.
			</p>

			<StatTiles
				tiles={[
					{
						label: "Laptops in stock",
						value: stats.stock ? String(stats.stock.available) : "–",
						description: stats.stock
							? `available now, plus ${stats.stock.allocated} allocated to cases`
							: "the Halo stock list hasn't been loaded yet",
					},
					{
						label: "Sessions held",
						value: String(stats.sessionsHeld),
						description: `${collections} ${collections === 1 ? "collection" : "collections"} and ${stats.sessionsHeld - collections} ${stats.sessionsHeld - collections === 1 ? "session" : "sessions"}`,
					},
					{
						label: "Replacements completed",
						value: String(stats.replacementsCompleted),
						description: "old device returned",
					},
					{
						label: "Awaiting old device",
						value: String(stats.awaitingReturn),
						description: "new laptop issued, old one not back (now)",
					},
				]}
			/>

			<div className="bcp-columns-halves">
				<section aria-labelledby="software-heading">
					<h2 id="software-heading">Most requested software</h2>
					<p className="bcp-secondary-text">
						Bookings that asked for each application, out of {stats.bookings}
					</p>
					{stats.software.listed.length || typedTotal ? (
						<BarList
							label="Bookings by application"
							unit="bookings"
							items={[
								...stats.software.listed.map((row) => ({
									label: row.name,
									value: row.count,
								})),
								...(typedTotal
									? [{ label: "Typed in by colleagues", value: typedTotal }]
									: []),
							]}
						/>
					) : (
						<p>No software was requested in this period.</p>
					)}
					{stats.software.typed.length ? (
						<Details summary="See typed-in applications">
							<Table
								caption="Typed-in applications"
								captionHidden
								columns={[
									{ key: "name", header: "Application" },
									{ key: "count", header: "Bookings", numeric: true },
								]}
								rows={stats.software.typed.map((row) => ({
									id: row.name,
									cells: { name: row.name, count: row.count },
								}))}
							/>
							<p className="bcp-secondary-text">
								Popular ones can be added to the software list in Settings.
							</p>
						</Details>
					) : null}
				</section>

				<section aria-labelledby="days-heading">
					<h2 id="days-heading">Most popular days</h2>
					<p className="bcp-secondary-text">
						Bookings by day of the session, out of {stats.bookings}
					</p>
					<ColumnChart
						unit="bookings"
						description={`Bookings by weekday: ${stats.weekdays.map((row) => `${WEEKDAYS[row.weekday - 1]} ${row.count}`).join(", ")}`}
						items={stats.weekdays.map((row) => ({
							label: WEEKDAYS[row.weekday - 1],
							value: row.count,
						}))}
					/>
					<Details summary="Show as a table">
						<Table
							caption="Bookings by weekday"
							captionHidden
							columns={[
								{ key: "day", header: "Day" },
								{ key: "count", header: "Bookings", numeric: true },
							]}
							rows={stats.weekdays.map((row) => ({
								id: String(row.weekday),
								cells: { day: WEEKDAYS[row.weekday - 1], count: row.count },
							}))}
						/>
					</Details>
				</section>
			</div>

			<section aria-labelledby="sessions-heading" className="bcp-section">
				<h2 id="sessions-heading">Sessions in this period</h2>
				<p className="bcp-secondary-text">
					Held sessions only. Cancelled sessions are not counted.
				</p>
				<Table
					caption="Sessions in this period"
					captionHidden
					empty="No sessions were held in this period."
					columns={[
						{ key: "type", header: "Type" },
						{ key: "held", header: "Held", numeric: true },
						{ key: "offered", header: "Places offered", numeric: true },
						{ key: "booked", header: "Booked", numeric: true },
						{ key: "filled", header: "Places filled", numeric: true },
						{ key: "dna", header: "Did not attend", numeric: true },
					]}
					rows={[
						...stats.sessions.map((row) => ({
							id: row.type,
							cells: {
								type: <TypeTag type={row.type} />,
								held: row.held,
								offered: row.offered,
								booked: row.booked,
								filled: percent(row.booked, row.offered),
								dna: row.didNotAttend,
							},
						})),
						...(stats.sessions.length > 1
							? [
									{
										id: "total",
										cells: {
											type: <strong>Total</strong>,
											held: <strong>{totals.held}</strong>,
											offered: <strong>{totals.offered}</strong>,
											booked: <strong>{totals.booked}</strong>,
											filled: (
												<strong>
													{percent(totals.booked, totals.offered)}
												</strong>
											),
											dna: <strong>{totals.didNotAttend}</strong>,
										},
									},
								]
							: []),
					]}
				/>
			</section>
		</LaptopsPage>
	);
}
