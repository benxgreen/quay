import type { Metadata } from "next";
import { type AppliedFilter, AppliedFilters } from "@/components/patterns/applied-filters";
import {
	ColumnChooser,
	FilterGrid,
	FilterOptions,
	FilterPanel,
} from "@/components/patterns/filter-panel";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { CaseStatusTag } from "@/components/service/replacements/status-tag";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkboxes";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { Select } from "@/components/ui/select";
import { TableSecondary } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { formatShortDate, formatShortDay, formatTime } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import { CASE_STATUS_LABELS, CASE_STATUSES } from "@/services/replacements/laptops/lib/case-status";
import {
	CASE_COLUMNS,
	CASE_SORTS,
	type CaseColumn,
	type CaseFilters,
	type CaseRow,
	DEFAULT_COLUMNS,
	listCases,
	parseCaseFilters,
} from "@/services/replacements/laptops/lib/cases";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

export const metadata: Metadata = { title: "Cases" };

const BASE = LAPTOPS_SECTIONS.cases.href;

type CasesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Mockups: AdminCases, AdminCasesAlt. Filters and columns live in the URL. */
export default async function CasesPage({ searchParams }: CasesPageProps) {
	await requireRole(ACCESS.laptops);
	const filters = parseCaseFilters(await searchParams);
	const cases = await listCases(filters);

	return (
		<LaptopsPage section="cases">
			<PageHeading title="Cases">
				<Button href={`${BASE}/new`}>Add a case</Button>
			</PageHeading>

			<FilterPanel
				search={{
					label: "Search cases",
					hint: "Name, email, serial, hostname or case reference",
					defaultValue: filters.search,
				}}
				clearHref={BASE}
			>
				<FilterGrid>
					<Select
						id="sort"
						name="sort"
						label="Sort by"
						defaultValue={filters.sort}
						options={Object.entries(CASE_SORTS).map(([value, label]) => ({
							value,
							label,
						}))}
					/>
					<Select
						id="status"
						name="status"
						label="Status"
						defaultValue={filters.status}
						options={[
							{ value: "", label: "All open cases" },
							...CASE_STATUSES.map((status) => ({
								value: status,
								label: CASE_STATUS_LABELS[status],
							})),
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
				<FilterOptions>
					<Checkbox
						id="flagged"
						name="flagged"
						value="1"
						label="Flagged only"
						small
						defaultChecked={filters.flagged}
					/>
					<Checkbox
						id="noDevice"
						name="noDevice"
						value="1"
						label="No device allocated"
						small
						defaultChecked={filters.noDevice}
					/>
					<Checkbox
						id="archived"
						name="archived"
						value="1"
						label="Include archived cases"
						small
						defaultChecked={filters.archived}
					/>
				</FilterOptions>
				<ColumnChooser
					name="columns"
					hint="Name is always shown."
					columns={Object.entries(CASE_COLUMNS).map(([value, label]) => ({
						value,
						label,
					}))}
					values={filters.columns}
				/>
			</FilterPanel>

			<AppliedFilters filters={appliedFilters(filters)} clearHref={BASE} />
			<p>
				{cases.length} {cases.length === 1 ? "case" : "cases"}
			</p>
			<ShowMoreTable
				key={JSON.stringify(filters)}
				caption="Cases"
				captionHidden
				noun="cases"
				empty="No cases match. Try changing the search or filters."
				columns={[
					{ key: "name", header: "Name" },
					...filters.columns.map((column) => ({
						key: column,
						header: CASE_COLUMNS[column],
					})),
				]}
				rows={cases.map((row) => ({
					id: row.id,
					cells: {
						name: (
							<>
								<Link href={`${BASE}/${row.reference}`}>{row.name}</Link>
								<TableSecondary>{row.reference}</TableSecondary>
							</>
						),
						...Object.fromEntries(
							filters.columns.map((column) => [column, cell(column, row)]),
						),
					},
				}))}
			/>
		</LaptopsPage>
	);
}

function cell(column: CaseColumn, row: CaseRow) {
	switch (column) {
		case "oldDevice":
			return (
				<>
					{row.oldSerial ?? "–"}
					{row.oldHostname ? <TableSecondary>{row.oldHostname}</TableSecondary> : null}
				</>
			);
		case "type":
			return <TypeTag type={row.type} />;
		case "status":
			return (
				<>
					<CaseStatusTag status={row.status} />
					{row.step ? <TableSecondary variant="step">{row.step}</TableSecondary> : null}
					{row.flagReason ? (
						<TableSecondary variant="flag">Flagged · {row.flagReason}</TableSecondary>
					) : null}
				</>
			);
		case "session":
			return row.session
				? `${formatShortDay(row.session.date)}, ${formatTime(row.session.time)}`
				: "–";
		case "box":
			return row.boxNumber ?? "–";
		case "software":
			return row.software === null
				? "–"
				: row.software.length > 0
					? row.software.join(", ")
					: "None";
		case "email":
			return row.email;
		case "department":
			return row.department ?? "–";
		case "added":
			return formatShortDate(row.addedAt);
		case "lastReminder":
			return row.lastReminderAt ? formatShortDate(row.lastReminderAt) : "–";
	}
}

/** One chip per filter that differs from the default, each linking to the list without it. */
function appliedFilters(filters: CaseFilters): AppliedFilter[] {
	const params = (without: string) => {
		const search = new URLSearchParams();
		if (filters.search && without !== "q") search.set("q", filters.search);
		if (filters.sort !== "session") search.set("sort", filters.sort);
		if (filters.status && without !== "status") search.set("status", filters.status);
		if (filters.type && without !== "type") search.set("type", filters.type);
		if (filters.flagged && without !== "flagged") search.set("flagged", "1");
		if (filters.noDevice && without !== "noDevice") search.set("noDevice", "1");
		if (filters.archived && without !== "archived") search.set("archived", "1");
		if (filters.columns.join() !== DEFAULT_COLUMNS.join()) {
			for (const column of filters.columns) search.append("columns", column);
		}
		const text = search.toString();
		return text ? `${BASE}?${text}` : BASE;
	};
	return [
		filters.search && { text: `Search: ${filters.search}`, removeHref: params("q") },
		filters.status && {
			text: `Status: ${CASE_STATUS_LABELS[filters.status]}`,
			removeHref: params("status"),
		},
		filters.type && {
			text: `Type: ${filters.type === "collection" ? "Collection" : "Session"}`,
			removeHref: params("type"),
		},
		filters.flagged && { text: "Flagged only", removeHref: params("flagged") },
		filters.noDevice && { text: "No device allocated", removeHref: params("noDevice") },
		filters.archived && { text: "Including archived cases", removeHref: params("archived") },
	].filter((filter): filter is AppliedFilter => Boolean(filter));
}
