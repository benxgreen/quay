import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { SessionStatusTag } from "@/components/service/replacements/status-tag";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Meter } from "@/components/ui/meter";
import { PageHeading } from "@/components/ui/page-heading";
import { Select } from "@/components/ui/select";
import { Sidebar } from "@/components/ui/sidebar";
import { Table } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { resolveToday } from "@/lib/clock";
import { formatMonth, formatShortDay, formatTime } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import {
	listSessions,
	parseSessionFilters,
	type SessionFilters,
	type SessionSummary,
} from "@/services/replacements/laptops/lib/sessions";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

export const metadata: Metadata = { title: "Sessions" };

const BASE = LAPTOPS_SECTIONS.sessions.href;

type SessionsPageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
	await requireRole(ACCESS.laptops);
	const params = await searchParams;
	const filters = parseSessionFilters(params);
	const { sessions, months } = await listSessions(filters, resolveToday(params.asOf));

	return (
		<LaptopsPage
			section="sessions"
			sidebarPosition="start"
			sidebarHeader={
				<>
					<PageHeading title="Sessions">
						<Button href={`${BASE}/new`}>Add a session</Button>
					</PageHeading>
					<p>{describeList(filters, sessions)}</p>
				</>
			}
			sidebar={<SessionFiltersPanel filters={filters} months={months} />}
		>
			<Table
				caption="Sessions"
				captionHidden
				columns={[
					{ key: "date", header: "Date" },
					{ key: "time", header: "Time" },
					{ key: "type", header: "Type" },
					{ key: "location", header: "Location" },
					{ key: "booked", header: "Booked" },
					{ key: "status", header: "Status" },
				]}
				empty="There are no sessions to show. Try changing the filters."
				rows={sessions.map((session) => ({
					id: session.id,
					cells: {
						date: (
							<Link href={`${BASE}/${session.id}`}>
								{formatShortDay(session.date, { year: true })}
							</Link>
						),
						time: formatTime(session.time),
						type: <TypeTag type={session.type} />,
						location: session.location,
						booked: (
							<>
								{session.booked} of {session.capacity}
								<Meter value={session.booked} max={session.capacity} />
							</>
						),
						status: <SessionStatusTag status={session.status} />,
					},
				}))}
			/>
		</LaptopsPage>
	);
}

/** "Showing 7 upcoming sessions in November 2026: 4 collections and 3 sessions." */
function describeList(filters: SessionFilters, sessions: SessionSummary[]): string {
	const when = filters.show;
	const month = filters.month ? ` in ${formatMonth(filters.month)}` : "";
	if (sessions.length === 0) return `There are no ${when} sessions${month}.`;

	const count = (type: SessionSummary["type"], noun: string) => {
		const n = sessions.filter((session) => session.type === type).length;
		return `${n} ${noun}${n === 1 ? "" : "s"}`;
	};
	return `Showing ${sessions.length} ${when} session${sessions.length === 1 ? "" : "s"}${month}: ${count("collection", "collection")} and ${count("session", "session")}.`;
}

/**
 * The filters beside the list (mockups: AdminSessions). A GET form, so the
 * filters live in the URL. "Apply filters" is a button rather than
 * filtering as each select changes, which would move people on without
 * warning (WCAG 3.2.2).
 */
function SessionFiltersPanel({ filters, months }: { filters: SessionFilters; months: string[] }) {
	return (
		<Sidebar label="Filter sessions">
			<form method="get" action={BASE}>
				<Select
					id="show"
					name="show"
					label="Show"
					defaultValue={filters.show}
					options={[
						{ value: "upcoming", label: "Upcoming" },
						{ value: "past", label: "Past" },
					]}
				/>
				<Select
					id="month"
					name="month"
					label="Month"
					defaultValue={filters.month}
					options={[
						{ value: "", label: "All months" },
						...months.map((month) => ({ value: month, label: formatMonth(month) })),
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
				<Select
					id="status"
					name="status"
					label="Status"
					defaultValue={filters.status}
					options={[
						{ value: "", label: "All statuses" },
						{ value: "open", label: "Open" },
						{ value: "full", label: "Full" },
						{ value: "closed", label: "Closed" },
						{ value: "cancelled", label: "Cancelled" },
					]}
				/>
				<ButtonGroup>
					<Button type="submit" variant="secondary">
						Apply filters
					</Button>
					<Link href={BASE}>Clear filters</Link>
				</ButtonGroup>
			</form>
		</Sidebar>
	);
}
