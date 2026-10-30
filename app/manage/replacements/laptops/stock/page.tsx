import type { Metadata } from "next";
import { FilterGrid, FilterOptions, FilterPanel } from "@/components/patterns/filter-panel";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { StockStatusTag } from "@/components/service/replacements/status-tag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkboxes";
import { Link } from "@/components/ui/link";
import { NotificationBanner, NotificationBannerDetail } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { Select } from "@/components/ui/select";
import { TableSecondary } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { formatShortDay, formatUpdatedAt } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import {
	listStock,
	loadStock,
	type StockFilters,
	type StockRow,
} from "@/services/replacements/laptops/lib/stock";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { refreshStockAction } from "./actions";

export const metadata: Metadata = { title: "Stock" };

const BASE = LAPTOPS_SECTIONS.stock.href;

type StockPageProps = { searchParams: Promise<Record<string, string | undefined>> };

/** Mockups: AdminStock. */
export default async function StockPage({ searchParams }: StockPageProps) {
	const user = await requireRole(ACCESS.laptops);
	const params = await searchParams;
	const filters: StockFilters = {
		search: (params.q ?? "").trim(),
		status: params.status === "available" || params.status === "allocated" ? params.status : "",
		model: params.model ?? "",
		location: params.location ?? "",
		issued: params.issued === "1",
	};
	const { snapshot, failed } = await loadStock(user.id);
	const rows = snapshot ? await listStock(snapshot, filters) : [];
	const models = [...new Set(snapshot?.devices.map((device) => device.model))].sort();
	const locations = [...new Set(snapshot?.devices.map((device) => device.stockLocation))].sort();
	const refreshFailed = params.refreshFailed ?? failed;

	return (
		<LaptopsPage section="stock">
			{refreshFailed ? (
				<NotificationBanner variant="failed" heading="Halo could not be reached">
					<NotificationBannerDetail>
						{refreshFailed}. Nothing has changed.
					</NotificationBannerDetail>
				</NotificationBanner>
			) : null}
			<PageHeading title="Stock">
				<div>
					<p className="bcp-secondary-text">
						Replacement laptops matching the Halo stock criteria.
						{snapshot
							? ` Updated from Halo at ${formatUpdatedAt(snapshot.fetchedAt)}.`
							: ""}
					</p>
					<form action={refreshStockAction}>
						<Button type="submit" variant="secondary">
							Refresh from Halo
						</Button>
					</form>
				</div>
			</PageHeading>
			<FilterPanel
				search={{
					label: "Search stock",
					hint: "Box number, serial or hostname",
					defaultValue: filters.search,
				}}
				clearHref={BASE}
			>
				<FilterGrid>
					<Select
						id="status"
						name="status"
						label="Status"
						defaultValue={filters.status}
						options={[
							{ value: "", label: "All" },
							{ value: "available", label: "Available" },
							{ value: "allocated", label: "Allocated" },
						]}
					/>
					<Select
						id="model"
						name="model"
						label="Model"
						defaultValue={filters.model}
						options={[
							{ value: "", label: "All models" },
							...models.map((m) => ({ value: m, label: m })),
						]}
					/>
					<Select
						id="location"
						name="location"
						label="Stock location"
						defaultValue={filters.location}
						options={[
							{ value: "", label: "All locations" },
							...locations.map((l) => ({ value: l, label: l })),
						]}
					/>
				</FilterGrid>
				<FilterOptions>
					<Checkbox
						id="issued"
						name="issued"
						value="1"
						label="Include issued devices"
						small
						defaultChecked={filters.issued}
					/>
				</FilterOptions>
			</FilterPanel>
			<p>
				{rows.length} laptop{rows.length === 1 ? "" : "s"}
			</p>
			<ShowMoreTable
				key={JSON.stringify(filters)}
				caption="Stock"
				captionHidden
				noun="laptops"
				empty="No laptops match. Try changing the search or filters."
				columns={[
					{ key: "box", header: "Box number" },
					{ key: "device", header: "Serial and hostname" },
					{ key: "model", header: "Model" },
					{ key: "location", header: "Stock location" },
					{ key: "status", header: "Status" },
					{ key: "case", header: "Allocated to" },
					{ key: "activity", header: "Last activity" },
				]}
				rows={rows.map((row) => ({
					id: row.assetId,
					cells: {
						box: (
							<Link href={`${BASE}/${encodeURIComponent(row.assetId)}`}>
								{row.assetId}
							</Link>
						),
						device: row.serial ? (
							<>
								{row.serial}
								<TableSecondary>{row.hostname}</TableSecondary>
							</>
						) : (
							"–"
						),
						model: row.model || "–",
						location: row.stockLocation
							? `${row.stockLocation} · ${row.stockRoom}`
							: "–",
						status: <StockStatusTag status={row.status} />,
						case: row.allocation ? (
							<>
								<Link
									href={`${LAPTOPS_SECTIONS.cases.href}/${row.allocation.reference}`}
								>
									{row.allocation.name}
								</Link>
								<TableSecondary>
									{row.allocation.reference} ·{" "}
									{row.allocation.type === "collection"
										? "Collection"
										: "Session"}
									{row.allocation.session
										? `, ${formatShortDay(row.allocation.session.date)}`
										: ""}
								</TableSecondary>
							</>
						) : (
							"–"
						),
						activity: row.lastActivity ? (
							<TableSecondary>
								{activityText(row)} ·{" "}
								{row.lastActivity.at.toLocaleDateString("en-GB", {
									day: "numeric",
									month: "short",
									timeZone: "Europe/London",
								})}
							</TableSecondary>
						) : (
							"–"
						),
					},
				}))}
			/>
		</LaptopsPage>
	);
}

/** A short version of the box's latest journal entry, such as "Allocated". */
function activityText(row: StockRow): string {
	const body = row.lastActivity?.body ?? "";
	const first = body
		.split(/[:(]/)[0]
		.replace(/ to .*$| from .*$/, "")
		.trim();
	return first.length > 40 ? `${first.slice(0, 40)}…` : first;
}
