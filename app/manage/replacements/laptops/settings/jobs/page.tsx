import type { Metadata } from "next";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Link } from "@/components/ui/link";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { Table, TableSecondary } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { formatShortDateTime, formatShortDay } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import { JOB_KEYS, JOBS } from "@/services/replacements/laptops/lib/jobs";
import { type JobRun, latestRuns, listJobRuns } from "@/services/replacements/laptops/lib/jobs/log";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { RunForm } from "./run-form";
import { RunResult } from "./run-result";

export const metadata: Metadata = { title: "Scheduled jobs" };

const BASE = `${LAPTOPS_SECTIONS.settings.href}/jobs`;

/** The jobs, when each last ran, and the job log (spec, "Scheduled jobs and events"). */
export default async function JobsPage({
	searchParams,
}: {
	searchParams: Promise<{ ran?: string }>;
}) {
	await requireRole(ACCESS.laptopsSettings);
	const { ran } = await searchParams;
	const [latest, { runs }] = await Promise.all([latestRuns(), listJobRuns(200)]);
	const ranIds = new Set((ran ?? "").split(",").filter(Boolean));
	// In the order they ran.
	const justRan = runs.filter((run) => ranIds.has(run.id)).reverse();
	const canRun = process.env.NODE_ENV !== "production";

	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]}>
			{justRan.length ? <RanBanner runs={justRan} /> : null}
			<PageHeading caption="Settings" title="Scheduled jobs" />
			<p>
				A timer runs every job together at 9:00am. Each job only sends what is due and skips
				anyone it has already emailed that day, so running it again never sends a duplicate.
			</p>

			<Table
				caption="Jobs"
				columns={[
					{ key: "job", header: "Job" },
					{ key: "runs", header: "Runs" },
					{ key: "last", header: "Last run" },
					{ key: "result", header: "Result" },
				]}
				rows={JOB_KEYS.map((key) => {
					const run = latest.get(key);
					return {
						id: key,
						cells: {
							job: JOBS[key].name,
							runs: JOBS[key].runs,
							last: run ? (
								<Link href={`${BASE}/${run.id}`}>{runWhen(run)}</Link>
							) : (
								"Never"
							),
							result: run ? <RunResult run={run} /> : "–",
						},
					};
				})}
			/>

			{canRun ? (
				<section>
					<h2>Run jobs now</h2>
					<p>
						Development only. Emails go through the email connection, so they are only
						sent for real when it is not the mock.
					</p>
					<RunForm jobs={JOB_KEYS.map((key) => ({ key, name: JOBS[key].name }))} />
				</section>
			) : null}

			<h2>Job log</h2>
			<ShowMoreTable
				caption="Job log"
				captionHidden
				noun="runs"
				empty="No jobs have run yet."
				columns={[
					{ key: "started", header: "Started" },
					{ key: "job", header: "Job" },
					{ key: "sent", header: "Sent", numeric: true },
					{ key: "failed", header: "Failed", numeric: true },
					{ key: "result", header: "Result" },
				]}
				rows={runs.map((run) => ({
					id: run.id,
					cells: {
						started: (
							<>
								<Link href={`${BASE}/${run.id}`}>
									{formatShortDateTime(run.startedAt)}
								</Link>
								{run.asIf ? (
									<TableSecondary>
										As if {formatShortDay(run.runDate, { year: true })}
									</TableSecondary>
								) : null}
							</>
						),
						job: (
							<>
								{run.name}
								<TableSecondary>
									{run.triggeredBy ? `Run by ${run.triggeredBy}` : "Timer"}
								</TableSecondary>
							</>
						),
						sent: run.processed,
						failed: run.failed,
						result: <RunResult run={run} />,
					},
				}))}
			/>
		</LaptopsPage>
	);
}

function runWhen(run: JobRun): string {
	const when = formatShortDateTime(run.startedAt);
	return run.asIf ? `${when} (as if ${formatShortDay(run.runDate, { year: true })})` : when;
}

/** One line on what a run did, such as "3 sent" or "Not a working day". */
function runSummary(run: JobRun): string {
	if (run.error) return `stopped (${run.error})`;
	if (!run.processed && !run.failed) return run.note ?? "nothing to do";
	return `${run.processed} sent${run.failed ? `, ${run.failed} failed` : ""}`;
}

function RanBanner({ runs }: { runs: JobRun[] }) {
	const problems = runs.some((run) => run.error || run.failed);
	return (
		<NotificationBanner
			variant={problems ? "failed" : "success"}
			heading={problems ? "Some jobs did not finish cleanly" : "Jobs run"}
		>
			<ul>
				{runs.map((run) => (
					<li key={run.id}>
						{run.name}: {runSummary(run)}
					</li>
				))}
			</ul>
		</NotificationBanner>
	);
}
