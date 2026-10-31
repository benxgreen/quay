import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Journal } from "@/components/patterns/journal";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { StockStatusTag } from "@/components/service/replacements/status-tag";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { Table, TableSecondary } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { requireRole } from "@/lib/auth/guards";
import {
	formatShortDate,
	formatShortDateTime,
	formatShortDay,
	formatTime,
	formatUpdatedAt,
} from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import { getDevice, loadStock } from "@/services/replacements/laptops/lib/stock";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { addDeviceNoteAction } from "../actions";

export const metadata: Metadata = { title: "Device – Stock" };

const OUTCOMES = {
	issued: "Issued",
	unallocated: "Unallocated",
	case_withdrawn: "Unallocated (case withdrawn)",
} as const;

type DevicePageProps = {
	params: Promise<{ box: string }>;
	searchParams: Promise<{ noteError?: string }>;
};

/** Mockups: AdminStockDevice. */
export default async function DevicePage({ params, searchParams }: DevicePageProps) {
	const user = await requireRole(ACCESS.laptops);
	const box = decodeURIComponent((await params).box);
	const { snapshot } = await loadStock(user.actorId);
	const detail = await getDevice(box, snapshot);
	if (!detail) notFound();
	const { noteError } = await searchParams;
	const { device, allocation } = detail;
	const cases = LAPTOPS_SECTIONS.cases.href;

	return (
		<LaptopsPage section="stock" parents={[LAPTOPS_SECTIONS.stock]}>
			<PageHeading
				caption="Stock"
				title={device?.serial || `Box ${box}`}
				tags={<StockStatusTag status={detail.status} />}
			/>

			<section>
				<h2>Device</h2>
				<SummaryList
					rows={[
						{ key: "Box number (asset ID)", value: box },
						{ key: "Hostname", value: device?.hostname || "–" },
						{ key: "Model", value: device?.model || "–" },
						{
							key: "Stock location",
							value: device
								? `${device.stockLocation} · ${device.stockRoom}`
								: "Not in Halo stock",
						},
						{
							key: "Case allocated to",
							value: allocation ? (
								<>
									<Link href={`${cases}/${allocation.reference}`}>
										{allocation.name}
									</Link>
									<SummaryListSecondary>
										{allocation.reference} ·{" "}
										{allocation.type === "collection"
											? "Collection"
											: "Session"}
										{allocation.session
											? `, ${formatShortDay(allocation.session.date)}, ${formatTime(allocation.session.time)}`
											: ""}
									</SummaryListSecondary>
								</>
							) : (
								"Not allocated"
							),
						},
					]}
				/>
				<p className="bcp-secondary-text bcp-body-small">
					Device details come from Halo
					{snapshot ? `, refreshed at ${formatUpdatedAt(snapshot.fetchedAt)}` : ""}.
					Allocate or unallocate it from the case.
				</p>
			</section>

			<section>
				<h2>Allocation history</h2>
				<Table
					caption="Allocation history"
					captionHidden
					empty="This device has not been allocated to a case."
					columns={[
						{ key: "case", header: "Case" },
						{ key: "allocated", header: "Allocated" },
						{ key: "removed", header: "Removed" },
						{ key: "outcome", header: "Outcome" },
					]}
					rows={detail.history.map((row) => ({
						id: row.id,
						cells: {
							case: (
								<>
									<Link href={`${cases}/${row.reference}`}>{row.name}</Link>
									<TableSecondary>{row.reference}</TableSecondary>
								</>
							),
							allocated: (
								<>
									{formatShortDate(row.allocatedAt)}
									{row.allocatedBy ? (
										<TableSecondary>{row.allocatedBy}</TableSecondary>
									) : null}
								</>
							),
							removed: row.removedAt ? (
								<>
									{formatShortDate(row.removedAt)}
									{row.removedBy ? (
										<TableSecondary>{row.removedBy}</TableSecondary>
									) : null}
								</>
							) : (
								"–"
							),
							outcome: row.outcome ? (
								<>
									{OUTCOMES[row.outcome]}
									{row.reason ? (
										<TableSecondary>{row.reason}</TableSecondary>
									) : null}
								</>
							) : (
								<Tag colour="light-blue">Current</Tag>
							),
						},
					}))}
				/>
			</section>

			<div id="journal">
				<Journal
					items={detail.journal.map((entry) => ({
						id: entry.id,
						when: formatShortDateTime(entry.at),
						text: entry.body,
						who: entry.who,
					}))}
					noteAction={addDeviceNoteAction.bind(null, box)}
					noteError={
						noteError === "empty"
							? "Enter a note"
							: noteError === "long"
								? "Note must be 2,000 characters or fewer"
								: undefined
					}
				/>
			</div>
		</LaptopsPage>
	);
}
