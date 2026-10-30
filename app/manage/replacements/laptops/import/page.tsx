import type { Metadata } from "next";
import { FilterGrid, FilterPanel } from "@/components/patterns/filter-panel";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Checkboxes } from "@/components/ui/checkboxes";
import { Details } from "@/components/ui/details";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Link } from "@/components/ui/link";
import { Note } from "@/components/ui/note";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { Select } from "@/components/ui/select";
import { TableSecondary } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { formatAgo, formatFullDate, formatLongDate, formatShortDate } from "@/lib/dates/format";
import { query } from "@/lib/db/query";
import { ACCESS } from "@/lib/portal/access";
import { CASE_STATUS_LABELS } from "@/services/replacements/laptops/lib/case-status";
import type { HiddenDevice, ReportDevice } from "@/services/replacements/laptops/lib/import";
import { estimator } from "@/services/replacements/laptops/lib/queue";
import { EligibleList, type EligibleRow } from "./eligible-list";
import { IMPORT_BASE, ImportHeader } from "./import-header";
import { loadImport } from "./load";

export const metadata: Metadata = { title: "Import" };

const SORTS = {
	oldest: "Purchase date (oldest first)",
	newest: "Purchase date (newest first)",
	seen: "Last seen",
	user: "Assigned user",
} as const;

type Sort = keyof typeof SORTS;

type ImportPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ImportPage({ searchParams }: ImportPageProps) {
	const user = await requireRole(ACCESS.laptops);
	const params = await searchParams;
	const one = (key: string) => {
		const value = params[key];
		return Array.isArray(value) ? value[0] : value;
	};
	const search = (one("q") ?? "").trim();
	const sort: Sort = (one("sort") as Sort) in SORTS ? (one("sort") as Sort) : "oldest";
	const models = [params.model ?? []].flat();
	const error =
		one("error") === "select" || one("error") === "type"
			? (one("error") as "select" | "type")
			: undefined;

	const data = await loadImport(user.id);
	const view = data.view;
	const [estimate, added] = await Promise.all([estimator(), addedCases(one("added"))]);

	const allEligible = view?.eligible ?? [];
	const modelCounts = new Map<string, number>();
	for (const device of allEligible)
		modelCounts.set(device.model, (modelCounts.get(device.model) ?? 0) + 1);
	const rows = filterAndSort(allEligible, search, models, sort).map(toRow);

	return (
		<LaptopsPage section="import">
			{error ? (
				<ErrorSummary
					errors={[
						error === "select"
							? {
									fieldId: "select-all",
									text: "Select at least one laptop to add to the invitation queue",
								}
							: { fieldId: "type", text: "Select the type for these laptops" },
					]}
				/>
			) : null}
			{added.length > 0 ? <AddedBanner cases={added} estimateAt={estimate.at} /> : null}
			<ImportHeader data={data} tab="eligible" refreshFailed={one("refreshFailed")} />

			{view ? (
				<>
					<Note>
						<p>
							<strong>
								Halo returned {view.report.devices.length} laptops.{" "}
								{view.eligible.length} {view.eligible.length === 1 ? "is" : "are"}{" "}
								ready to import.
							</strong>{" "}
							{view.attention.length}{" "}
							<Link href={`${IMPORT_BASE}/attention`}>
								{view.attention.length === 1 ? "needs" : "need"} attention
							</Link>{" "}
							before {view.attention.length === 1 ? "it can" : "they can"} be
							imported, and {view.hidden.length}{" "}
							{view.hidden.length === 1 ? "is" : "are"} hidden because{" "}
							{view.hidden.length === 1 ? "it is" : "they are"} already in the
							workflow or {view.hidden.length === 1 ? "was" : "were"} replaced before.{" "}
							{view.hidden.length > 0 ? (
								<Link href="#hidden">See hidden laptops</Link>
							) : null}
						</p>
					</Note>

					<FilterPanel
						search={{
							label: "Search eligible devices",
							hint: "Name, email, serial, hostname or asset ID",
							defaultValue: search,
						}}
						clearHref={IMPORT_BASE}
					>
						<FilterGrid>
							<Select
								id="sort"
								name="sort"
								label="Sort by"
								defaultValue={sort}
								options={Object.entries(SORTS).map(([value, label]) => ({
									value,
									label,
								}))}
							/>
						</FilterGrid>
						<Checkboxes
							name="model"
							legend="Model"
							legendSize="s"
							hint="Models in the latest Halo report."
							small
							values={models}
							items={[...modelCounts]
								.sort(([a], [b]) => a.localeCompare(b))
								.map(([model, count]) => ({
									value: model,
									label: `${model} (${count})`,
								}))}
						/>
					</FilterPanel>

					<EligibleList
						key={JSON.stringify([search, models, sort])}
						rows={rows}
						queued={data.queued}
						perDay={estimate.perDay}
						runDays={estimate.runDays}
						error={error}
					/>

					<HiddenLaptops hidden={view.hidden} />
				</>
			) : null}
		</LaptopsPage>
	);
}

function filterAndSort(devices: ReportDevice[], search: string, models: string[], sort: Sort) {
	const needle = search.toLowerCase();
	const matching = devices.filter(
		(device) =>
			(models.length === 0 || models.includes(device.model)) &&
			(!needle ||
				[
					device.user?.displayName,
					device.user?.email,
					device.serial,
					device.hostname,
					device.assetId,
				]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(needle))),
	);
	const by: Record<Sort, (a: ReportDevice, b: ReportDevice) => number> = {
		oldest: (a, b) => a.purchaseDate.localeCompare(b.purchaseDate),
		newest: (a, b) => b.purchaseDate.localeCompare(a.purchaseDate),
		seen: (a, b) => b.lastSeen.localeCompare(a.lastSeen),
		user: (a, b) => (a.user?.displayName ?? "").localeCompare(b.user?.displayName ?? ""),
	};
	return matching.sort(by[sort]);
}

function toRow(device: ReportDevice): EligibleRow {
	return {
		assetId: device.assetId,
		serial: device.serial,
		hostname: device.hostname,
		model: device.model,
		purchased: formatShortDate(new Date(`${device.purchaseDate}T12:00:00Z`)),
		lastSeen: formatAgo(new Date(device.lastSeen)),
		lastSignIn: device.user?.lastSignIn ? formatAgo(new Date(device.user.lastSignIn)) : "–",
		name: device.user?.displayName ?? "",
		email: device.user?.email ?? "",
	};
}

/** "See 22 hidden laptops", each with why, as a sentence. */
function HiddenLaptops({ hidden }: { hidden: HiddenDevice[] }) {
	if (hidden.length === 0) return null;
	return (
		<div id="hidden">
			<Details
				summary={`See ${hidden.length} hidden laptop${hidden.length === 1 ? "" : "s"}`}
			>
				<ShowMoreTable
					caption="Hidden laptops"
					captionHidden
					noun="hidden laptops"
					columns={[
						{ key: "laptop", header: "Laptop" },
						{ key: "user", header: "Assigned user" },
						{ key: "why", header: "Why it is hidden" },
					]}
					rows={hidden.map((device) => ({
						id: device.assetId,
						cells: {
							laptop: (
								<>
									{device.serial}
									<TableSecondary>{device.hostname}</TableSecondary>
								</>
							),
							user: device.assignedUser?.name ?? "None",
							why: hiddenReason(device),
						},
					}))}
				/>
			</Details>
		</div>
	);
}

function hiddenReason({ reason }: HiddenDevice): string {
	switch (reason.kind) {
		case "open_case":
			return `This laptop is already in the workflow (case ${reason.reference}, ${CASE_STATUS_LABELS[reason.status].toLowerCase()}).`;
		case "completed_case":
			return `This laptop was already replaced on ${formatFullDate(reason.closedAt)} (case ${reason.reference}).`;
		case "previous":
			return reason.completedOn
				? `This laptop was already replaced in ${new Date(`${reason.completedOn}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}, recorded in the old workbook.`
				: "This laptop was already replaced, recorded in the old workbook.";
	}
}

type AddedCase = { id: string; reference: string; name: string; type: string; position: number };

/** The cases just added, with their places, for the success banner. */
async function addedCases(ids: string | undefined): Promise<AddedCase[]> {
	const list = (ids ?? "")
		.split(",")
		.filter((id) => /^\d+$/.test(id))
		.slice(0, 200);
	if (list.length === 0) return [];
	const rows = await query<AddedCase & { position: string }>(
		`SELECT * FROM (
		   SELECT c.id, c.reference, u.display_name AS name, c.session_type AS type,
		          row_number() OVER (ORDER BY c.queued_at, c.id) AS position
		   FROM lr.cases c JOIN portal.users u ON u.id = c.user_id
		   WHERE c.status = 'queued'
		 ) q WHERE q.id = ANY($1::bigint[])
		 ORDER BY q.position`,
		[list],
	);
	return rows.map((row) => ({ ...row, position: Number(row.position) }));
}

function AddedBanner({
	cases,
	estimateAt,
}: {
	cases: AddedCase[];
	estimateAt: (position: number) => string | null;
}) {
	const first = cases[0];
	const last = cases[cases.length - 1];
	const type = first.type === "collection" ? "Collection" : "Session";
	const from = estimateAt(first.position);
	const to = estimateAt(last.position);
	const when =
		from && to
			? from === to
				? formatLongDate(from)
				: `${formatLongDate(from)} to ${formatLongDate(to)}`
			: null;

	return (
		<NotificationBanner
			variant="success"
			heading={`${cases.length} laptop${cases.length === 1 ? "" : "s"} added to the invitation queue as ${type}`}
		>
			<ul>
				{cases.map((c) => (
					<li key={c.id}>
						{c.name} (case {c.reference})
					</li>
				))}
			</ul>
			<p>
				{cases.length === 1
					? `It is number ${first.position} in the `
					: `They are numbers ${first.position} to ${last.position} in the `}
				<Link href={`${IMPORT_BASE}/queue`}>invitation queue</Link>.
				{when ? ` Estimated invitation: ${when}.` : ""}
			</p>
		</NotificationBanner>
	);
}
