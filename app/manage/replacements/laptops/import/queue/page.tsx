import type { Metadata } from "next";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Link, LinkButton } from "@/components/ui/link";
import { Note } from "@/components/ui/note";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { SearchBox } from "@/components/ui/search-box";
import { TableSecondary } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { formatLongDate, formatShortDate, formatShortDay } from "@/lib/dates/format";
import { queryOne } from "@/lib/db/query";
import { ACCESS } from "@/lib/portal/access";
import {
	getQueuedCase,
	listQueue,
	type QueueEntry,
} from "@/services/replacements/laptops/lib/queue";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { moveCaseToFront } from "../actions";
import { IMPORT_BASE, ImportHeader } from "../import-header";
import { loadImport } from "../load";

export const metadata: Metadata = { title: "Invitation queue – Import – Laptop replacements" };

const QUEUE = `${IMPORT_BASE}/queue`;

type QueuePageProps = {
	searchParams: Promise<{
		q?: string;
		moved?: string;
		typeChanged?: string;
		removed?: string;
		refreshFailed?: string;
	}>;
};

/** Mockups: AdminQueue. */
export default async function QueuePage({ searchParams }: QueuePageProps) {
	const user = await requireRole(ACCESS.laptops);
	const params = await searchParams;
	const search = (params.q ?? "").trim();
	const [data, queue] = await Promise.all([loadImport(user.id), listQueue(search)]);

	return (
		<LaptopsPage section="import" parents={[LAPTOPS_SECTIONS.import]}>
			<QueueBanner params={params} entries={queue.entries} />
			<ImportHeader data={data} tab="queue" refreshFailed={params.refreshFailed} />
			<Note>
				<p>
					<strong>
						{queue.total} {queue.total === 1 ? "case is" : "cases are"} waiting for an
						invitation.
					</strong>{" "}
					Up to {queue.perDay} go out at 9am each working day, in this order. Estimated
					dates update if the limit changes or cases are moved or removed.
				</p>
			</Note>
			<SearchBox
				label="Search the queue"
				hint="Name, email, serial, hostname or case reference. Results keep their place number in the queue."
				defaultValue={search}
				action={QUEUE}
			/>
			<ShowMoreTable
				key={search}
				caption="Invitation queue"
				captionHidden
				noun="cases"
				empty={
					search
						? "No queued cases match your search."
						: "No cases are waiting for an invitation."
				}
				columns={[
					{ key: "position", header: "No.", numeric: true },
					{ key: "person", header: "Person" },
					{ key: "laptop", header: "Laptop" },
					{ key: "type", header: "Type" },
					{ key: "added", header: "Added" },
					{ key: "estimate", header: "Estimated invitation" },
					{ key: "actions", header: <span className="sr-only">Actions</span> },
				]}
				rows={queue.entries.map((entry) => ({
					id: entry.caseId,
					cells: {
						position: entry.position,
						person: (
							<>
								{entry.name}
								<TableSecondary>{entry.reference}</TableSecondary>
							</>
						),
						laptop: (
							<>
								{entry.serial ?? "–"}
								{entry.hostname ? (
									<TableSecondary>{entry.hostname}</TableSecondary>
								) : null}
							</>
						),
						type: <TypeTag type={entry.type} />,
						added: formatShortDate(entry.addedAt),
						estimate: entry.estimate ? formatShortDay(entry.estimate) : "–",
						actions: <QueueActions entry={entry} />,
					},
				}))}
			/>
			<p className="bcp-body-small bcp-secondary-text">
				Removing a case from the queue withdraws it, and the laptop shows on the Eligible
				devices tab again.
			</p>
		</LaptopsPage>
	);
}

function QueueActions({ entry }: { entry: QueueEntry }) {
	return (
		<span className="bcp-table-actions">
			{entry.position > 1 ? (
				<form action={moveCaseToFront.bind(null, entry.caseId)}>
					<LinkButton>
						Move to front<span className="sr-only"> {entry.name}</span>
					</LinkButton>
				</form>
			) : null}
			<Link href={`${QUEUE}/${entry.caseId}/change-type`}>
				Change type<span className="sr-only"> for {entry.name}</span>
			</Link>
			<Link href={`${QUEUE}/${entry.caseId}/remove`}>
				Remove<span className="sr-only"> {entry.name}</span>
			</Link>
		</span>
	);
}

/** The banner after moving, changing the type of, or removing a case. */
async function QueueBanner({
	params,
	entries,
}: {
	params: { moved?: string; typeChanged?: string; removed?: string };
	entries: QueueEntry[];
}) {
	if (params.moved || params.typeChanged) {
		const entry = await getQueuedCase(params.moved ?? params.typeChanged ?? "");
		if (!entry) return null;
		const estimate = entries.find((e) => e.caseId === entry.caseId)?.estimate;
		if (params.moved) {
			return (
				<NotificationBanner
					variant="success"
					heading={`${entry.name} moved to the front of the queue`}
				>
					<p>
						Case {entry.reference} is now number 1.
						{estimate ? ` Estimated invitation: ${formatLongDate(estimate)}.` : ""}
					</p>
				</NotificationBanner>
			);
		}
		const type = entry.type === "collection" ? "Collection" : "Session";
		return (
			<NotificationBanner variant="success" heading={`${entry.name} changed to ${type}`}>
				<p>
					Case {entry.reference} is still number {entry.position} in the queue. Their
					invitation will offer {entry.type} dates.
				</p>
			</NotificationBanner>
		);
	}
	if (params.removed && /^\d+$/.test(params.removed)) {
		const row = await queryOne<{ reference: string; name: string }>(
			`SELECT c.reference, u.display_name AS name
			 FROM lr.cases c JOIN portal.users u ON u.id = c.user_id
			 WHERE c.id = $1 AND c.status = 'withdrawn'`,
			[params.removed],
		);
		if (!row) return null;
		return (
			<NotificationBanner
				variant="success"
				heading={`${row.name} removed from the invitation queue`}
			>
				<p>
					Case {row.reference} has been withdrawn. The laptop shows on{" "}
					<Link href={IMPORT_BASE}>Eligible devices</Link> again.
				</p>
			</NotificationBanner>
		);
	}
	return null;
}
