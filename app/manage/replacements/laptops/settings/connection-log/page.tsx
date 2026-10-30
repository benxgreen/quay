import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FilterBar } from "@/components/patterns/filter-bar";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Details } from "@/components/ui/details";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { Select } from "@/components/ui/select";
import { TableSecondary } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { TextInput } from "@/components/ui/text-input";
import { requireRole } from "@/lib/auth/guards";
import { formatShortDateTime } from "@/lib/dates/format";
import { ACCESS, canAccess } from "@/lib/portal/access";
import { listConnectionLog, listConnections } from "@/lib/portal/connections";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SETTINGS } from "../definitions";

export const metadata: Metadata = { title: "Connection log" };

type Props = {
	searchParams: Promise<{ connection?: string; result?: string; q?: string }>;
};

/** Mockups: AdminConnectionLog. Administrator users only. */
export default async function ConnectionLogPage({ searchParams }: Props) {
	const user = await requireRole(ACCESS.laptopsSettings);
	if (!canAccess(user.roles, ACCESS.management)) redirect(SETTINGS);
	const params = await searchParams;
	const connections = await listConnections();
	const filters = {
		connection: connections.some((c) => c.key === params.connection)
			? (params.connection ?? "")
			: "",
		result: params.result === "success" || params.result === "failed" ? params.result : "",
		q: (params.q ?? "").trim(),
	};
	const entries = await listConnectionLog(filters);
	const failed = entries.filter((entry) => entry.outcome === "failed").length;
	const labels = new Map(connections.map((c) => [c.key, c.label]));

	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]}>
			<PageHeading caption="Settings · Connections" title="Connection log" />
			<p>
				Every call the portal makes to Halo and Power Automate. Entries are deleted after 7
				days.
			</p>
			<FilterBar label="Connection log">
				<Select
					id="connection"
					name="connection"
					label="Connection"
					defaultValue={filters.connection}
					options={[
						{ value: "", label: "All connections" },
						...connections.map((c) => ({ value: c.key, label: c.label })),
					]}
				/>
				<Select
					id="result"
					name="result"
					label="Result"
					defaultValue={filters.result}
					options={[
						{ value: "", label: "All results" },
						{ value: "success", label: "Success" },
						{ value: "failed", label: "Failed" },
					]}
				/>
				<TextInput id="q" name="q" label="Case" width="20" defaultValue={filters.q} />
			</FilterBar>
			<p>
				{entries.length} {entries.length === 1 ? "entry" : "entries"} in the last 7 days
				{failed ? ` · ${failed} failed` : ""}
			</p>
			<ShowMoreTable
				key={JSON.stringify(filters)}
				caption="Connection log"
				captionHidden
				noun="entries"
				empty="No calls match. Try changing the filters."
				columns={[
					{ key: "time", header: "Time" },
					{ key: "connection", header: "Connection" },
					{ key: "trigger", header: "Triggered by" },
					{ key: "case", header: "Case" },
					{ key: "result", header: "Result" },
				]}
				rows={entries.map((entry) => ({
					id: entry.id,
					cells: {
						time: formatShortDateTime(entry.occurredAt),
						connection: labels.get(entry.connection) ?? entry.connection,
						trigger: `${entry.triggerLabel}${entry.actor ? ` by ${entry.actor}` : entry.triggerKind === "schedule" ? " (scheduled)" : ""}`,
						case: entry.caseReference ? (
							<>
								<Link
									href={`${LAPTOPS_SECTIONS.cases.href}/${entry.caseReference}`}
								>
									{entry.caseName ?? entry.caseReference}
								</Link>
								<TableSecondary>{entry.caseReference}</TableSecondary>
							</>
						) : (
							"–"
						),
						result: (
							<>
								{entry.outcome === "success" ? (
									<Tag colour="green">Success</Tag>
								) : (
									<Tag colour="red">Failed</Tag>
								)}
								{entry.statusCode || entry.summary ? (
									<TableSecondary>
										{[entry.statusCode, entry.summary]
											.filter(Boolean)
											.join(" · ")}
									</TableSecondary>
								) : null}
								{entry.error ? (
									<Details summary="Error details">
										<p>{entry.error}</p>
									</Details>
								) : null}
							</>
						),
					},
				}))}
			/>
		</LaptopsPage>
	);
}
