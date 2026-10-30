import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { SummaryList } from "@/components/ui/summary-list";
import { TableSecondary } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { requireRole } from "@/lib/auth/guards";
import { formatShortDateTime, formatShortDay } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import { getJobRun } from "@/services/replacements/laptops/lib/jobs/log";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { RunResult } from "../run-result";

export const metadata: Metadata = { title: "Job run" };

/** One job run and every case it touched. */
export default async function JobRunPage({ params }: { params: Promise<{ id: string }> }) {
	await requireRole(ACCESS.laptopsSettings);
	const found = await getJobRun((await params).id);
	if (!found) notFound();
	const { run, cases } = found;
	const jobsHref = `${LAPTOPS_SECTIONS.settings.href}/jobs`;

	return (
		<LaptopsPage
			section="settings"
			parents={[LAPTOPS_SECTIONS.settings, { text: "Scheduled jobs", href: jobsHref }]}
		>
			<PageHeading caption="Scheduled jobs" title={run.name} />
			<SummaryList
				rows={[
					{ key: "Result", value: <RunResult run={run} /> },
					{
						key: "Day",
						value: `${formatShortDay(run.runDate, { year: true })}${run.asIf ? " (run as if it was today)" : ""}`,
					},
					{ key: "Run by", value: run.triggeredBy ?? "Timer" },
					{ key: "Started", value: formatShortDateTime(run.startedAt) },
					{
						key: "Finished",
						value: run.finishedAt
							? formatShortDateTime(run.finishedAt)
							: "Still running",
					},
					{ key: "Sent", value: String(run.processed) },
					{ key: "Failed", value: String(run.failed) },
					...(run.note ? [{ key: "Note", value: run.note }] : []),
					...(run.error ? [{ key: "Stopped because", value: run.error }] : []),
				]}
			/>

			<h2>Cases</h2>
			<ShowMoreTable
				caption="Cases this run touched"
				captionHidden
				noun="cases"
				empty="This run did not touch any cases."
				columns={[
					{ key: "name", header: "Name" },
					{ key: "outcome", header: "Email" },
					{ key: "at", header: "Time" },
				]}
				rows={cases.map((row, index) => ({
					id: `${row.reference}-${index}`,
					cells: {
						name: (
							<>
								<Link href={`${LAPTOPS_SECTIONS.cases.href}/${row.reference}`}>
									{row.personName}
								</Link>
								<TableSecondary>{row.reference}</TableSecondary>
							</>
						),
						outcome:
							row.outcome === "sent" ? (
								<Tag colour="green">Sent</Tag>
							) : (
								<>
									<Tag colour="red">Failed</Tag>
									{row.detail ? (
										<TableSecondary>{row.detail}</TableSecondary>
									) : null}
								</>
							),
						at: formatShortDateTime(row.at),
					},
				}))}
			/>
			<p>
				<Link href={jobsHref}>Back to scheduled jobs</Link>
			</p>
		</LaptopsPage>
	);
}
