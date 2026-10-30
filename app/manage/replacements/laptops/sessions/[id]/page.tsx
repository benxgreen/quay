import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { CaseStatusTag, SessionStatusTag } from "@/components/service/replacements/status-tag";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Button, ButtonGroup } from "@/components/ui/button";
import { InsetText } from "@/components/ui/inset-text";
import { NotificationBanner, NotificationBannerDetail } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { PrintButton } from "@/components/ui/print-button";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { Table, TableSecondary } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { requireRole } from "@/lib/auth/guards";
import { ExternalCallError } from "@/lib/clients/connection-log";
import { formatFullDate, formatShortDateTime } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import { getLaptopHaloClient } from "@/services/replacements/laptops/lib/halo";
import { getSession, type SessionDetail } from "@/services/replacements/laptops/lib/sessions";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { sessionCrumb, sessionTitle } from "../session-text";

export const metadata: Metadata = { title: "Session" };

type SessionPageProps = {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ saved?: string; cancelled?: string }>;
};

const BASE = LAPTOPS_SECTIONS.sessions.href;

export default async function SessionPage({ params, searchParams }: SessionPageProps) {
	const user = await requireRole(ACCESS.laptops);
	const { id } = await params;
	const session = await getSession(id);
	if (!session) notFound();
	const { saved, cancelled } = await searchParams;

	return (
		<LaptopsPage section="sessions" parents={[LAPTOPS_SECTIONS.sessions]}>
			{saved === "added" || saved === "updated" ? (
				<NotificationBanner
					variant="success"
					heading={saved === "added" ? "Session added" : "Session updated"}
				/>
			) : null}
			{cancelled === "1" && session.cancelled ? <CancelledBanners session={session} /> : null}

			<PageHeading
				caption="Session"
				title={sessionTitle(session)}
				tags={
					<>
						<TypeTag type={session.type} />
						<SessionStatusTag status={session.status} />
					</>
				}
			>
				{session.cancelled ? null : (
					<ButtonGroup>
						<PrintButton>Print attendee list</PrintButton>
						<Button variant="secondary" href={`${BASE}/${id}/edit`}>
							Edit session
						</Button>
					</ButtonGroup>
				)}
			</PageHeading>

			{session.cancelled ? (
				<CancelledSession session={session} />
			) : (
				<OpenSession session={session} actorUserId={user.id} />
			)}
		</LaptopsPage>
	);
}

async function OpenSession({
	session,
	actorUserId,
}: {
	session: SessionDetail;
	actorUserId: string;
}) {
	const hostnames = await boxHostnames(actorUserId);
	const { attendees } = session;
	const needSoftware = attendees.filter((attendee) => attendee.software.length > 0);
	const needNone = attendees.length - needSoftware.length;
	const canCancel =
		(session.status === "open" || session.status === "full") && session.startsAt > new Date();

	return (
		<>
			<SummaryList
				rows={[
					{ key: "Location", value: session.location },
					{ key: "Booked", value: `${session.booked} of ${session.capacity}` },
					{
						key: "Devices prepared",
						value: `${attendees.filter((attendee) => attendee.devicePrepared).length} of ${attendees.length}`,
					},
					{
						key: "Software prepared",
						value: (
							<>
								{
									needSoftware.filter((attendee) => attendee.softwarePrepared)
										.length
								}{" "}
								of {needSoftware.length}
								{needNone > 0 ? (
									<span className="bcp-secondary-text">
										{" "}
										({needNone}{" "}
										{needNone === 1 ? "person needs" : "people need"} none)
									</span>
								) : null}
							</>
						),
					},
				]}
			/>

			<h2>Attendees</h2>
			<Table
				caption="Attendees"
				captionHidden
				columns={[
					{ key: "name", header: "Name" },
					{ key: "case", header: "Case" },
					{ key: "box", header: "Box number" },
					{ key: "hostname", header: "Hostname" },
					{ key: "software", header: "Software requested" },
					{ key: "device", header: "Device" },
					{ key: "softwarePrepared", header: "Software" },
				]}
				empty="No one is booked on this session yet."
				rows={attendees.map((attendee) => ({
					id: attendee.caseId,
					cells: {
						name: attendee.name,
						case: attendee.reference,
						box: attendee.boxNumber ?? "Not allocated",
						hostname: (attendee.boxNumber && hostnames?.get(attendee.boxNumber)) ?? "–",
						software:
							attendee.software.length > 0 ? attendee.software.join(", ") : "None",
						device: <PreparedTag prepared={attendee.devicePrepared} />,
						softwarePrepared:
							attendee.software.length > 0 ? (
								<PreparedTag prepared={attendee.softwarePrepared} />
							) : (
								"–"
							),
					},
				}))}
			/>

			{canCancel ? (
				<p>
					<Button variant="warning" href={`${BASE}/${session.id}/cancel`}>
						Cancel this session
					</Button>
				</p>
			) : null}
		</>
	);
}

function PreparedTag({ prepared }: { prepared: boolean }) {
	return prepared ? <Tag colour="green">Prepared</Tag> : <Tag colour="grey">Not prepared</Tag>;
}

/** Each allocated box's hostname, from the Halo stock list. Null if Halo can't be reached. */
async function boxHostnames(actorUserId: string): Promise<Map<string, string> | null> {
	try {
		const { value } = await getLaptopHaloClient().listStock({
			trigger: { kind: "user", label: "Session page", actorUserId },
		});
		return new Map(value.map((device) => [device.assetId, device.hostname]));
	} catch (error) {
		if (error instanceof ExternalCallError) return null;
		throw error;
	}
}

function CancelledSession({ session }: { session: SessionDetail }) {
	const cancelled = session.cancelled;
	if (!cancelled) return null;

	return (
		<>
			<InsetText shaded>
				<p>
					<strong>
						This session was cancelled on {formatFullDate(cancelled.at)}
						{cancelled.by ? ` by ${cancelled.by}` : ""}.
					</strong>{" "}
					It is hidden from colleagues and cannot be booked or changed.
				</p>
			</InsetText>
			<SummaryList
				rows={[
					{ key: "Location", value: session.location },
					{ key: "Capacity", value: String(session.capacity) },
					{
						key: "Booked when cancelled",
						value: `${session.cancelledAttendees.length} of ${session.capacity}`,
					},
					{
						key: "Reason",
						value: (
							<>
								{cancelled.reason ?? "None given"}
								<SummaryListSecondary>
									Internal only. Not included in emails.
								</SummaryListSecondary>
							</>
						),
					},
				]}
			/>

			<h2>People who were booked</h2>
			<p className="bcp-secondary-text">
				Each was sent the Session cancelled email and their case moved to Rebook required.
				Their software choices were kept.
			</p>
			<Table
				caption="People who were booked"
				captionHidden
				columns={[
					{ key: "name", header: "Name" },
					{ key: "case", header: "Case" },
					{ key: "email", header: "Email sent" },
					{ key: "now", header: "Case now" },
				]}
				empty="No one was booked on this session."
				rows={session.cancelledAttendees.map((person) => ({
					id: person.caseId,
					cells: {
						name: person.name,
						case: person.reference,
						email: person.emailFailed ? (
							<Tag colour="red">Not sent</Tag>
						) : person.emailSentAt ? (
							formatShortDateTime(person.emailSentAt)
						) : (
							"–"
						),
						now: (
							<>
								<CaseStatusTag status={person.caseStatus} />
								{person.rebookedOnto ? (
									<TableSecondary>
										Rebooked onto {sessionCrumb(person.rebookedOnto)}
									</TableSecondary>
								) : person.caseStatus === "rebook_required" ? (
									<TableSecondary>Weekly reminders until rebooked</TableSecondary>
								) : null}
							</>
						),
					},
				}))}
			/>
		</>
	);
}

/** After cancelling: who was emailed, and anyone who wasn't. */
function CancelledBanners({ session }: { session: SessionDetail }) {
	const people = session.cancelledAttendees;
	const notSent = people.filter((person) => person.emailFailed);
	const sent = people.length - notSent.length;

	return (
		<>
			{notSent.length > 0 ? (
				<NotificationBanner
					variant="failed"
					heading="Some Session cancelled emails were not sent"
				>
					<NotificationBannerDetail>
						The session is cancelled, but these people were not emailed:{" "}
						{notSent.map((person) => `${person.name} (${person.reference})`).join(", ")}
						. Each case’s journal shows the failure.
					</NotificationBannerDetail>
				</NotificationBanner>
			) : null}
			<NotificationBanner variant="success" heading="Session cancelled">
				{people.length > 0 ? (
					<NotificationBannerDetail>
						{sent} {sent === 1 ? "person has" : "people have"} been emailed to choose a
						new date.
					</NotificationBannerDetail>
				) : null}
			</NotificationBanner>
		</>
	);
}
