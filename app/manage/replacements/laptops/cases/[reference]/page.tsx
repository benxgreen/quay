import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionList, type ActionListItem } from "@/components/patterns/action-list";
import { Journal } from "@/components/patterns/journal";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { BookingStatusTag, CaseStatusTag } from "@/components/service/replacements/status-tag";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { InsetText } from "@/components/ui/inset-text";
import { NotificationBanner, NotificationBannerDetail } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { Sidebar } from "@/components/ui/sidebar";
import { type Step, StepList } from "@/components/ui/step-list";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { Table } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { requireRole } from "@/lib/auth/guards";
import {
	formatFullDate,
	formatLongDate,
	formatShortDate,
	formatShortDateTime,
	formatShortDay,
	formatTime,
} from "@/lib/dates/format";
import { ACCESS, canAccess } from "@/lib/portal/access";
import { STEP_TITLES } from "@/services/replacements/laptops/lib/case-steps";
import {
	availableActions,
	type CaseAction,
	type CaseDetail,
	getCase,
} from "@/services/replacements/laptops/lib/cases";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { addCaseNote } from "../actions";

export const metadata: Metadata = { title: "Case – Laptop replacements" };

const BASE = LAPTOPS_SECTIONS.cases.href;

type CasePageProps = {
	params: Promise<{ reference: string }>;
	searchParams: Promise<{ done?: string; noteError?: string }>;
};

/** Mockups: AdminCase and its stages, AdminCaseArchived. */
export default async function CasePage({ params, searchParams }: CasePageProps) {
	const user = await requireRole(ACCESS.laptops);
	const { reference } = await params;
	const detail = await getCase(reference);
	if (!detail) notFound();
	const { done, noteError } = await searchParams;
	const href = `${BASE}/${reference}`;
	const actions = availableActions(detail).filter(
		(action) => action !== "withdraw" || canAccess(user.roles, ACCESS.laptopsSettings),
	);
	const panel = actionItems(detail, actions, href);

	return (
		<LaptopsPage
			section="cases"
			parents={[LAPTOPS_SECTIONS.cases]}
			sidebar={
				panel.length > 0 ? (
					<Sidebar label="Case actions">
						<ActionList items={panel} />
					</Sidebar>
				) : undefined
			}
		>
			{done ? <DoneBanner action={done} detail={detail} /> : null}
			<PageHeading
				caption={`Case ${detail.reference}`}
				title={detail.person.name}
				tags={
					<>
						<CaseStatusTag status={detail.status} />
						<TypeTag type={detail.type} />
						{detail.flag ? <Tag colour="red">Flagged</Tag> : null}
					</>
				}
			/>
			{detail.flag ? (
				<p>
					<strong>Flagged:</strong> {detail.flag.reason ?? "No reason given"}{" "}
					<span className="bcp-secondary-text">
						({detail.flag.by ?? "System"}, {formatShortDate(detail.flag.at)})
					</span>
				</p>
			) : null}
			{detail.archived ? (
				<InsetText shaded>
					<p>
						<strong>This case is archived.</strong> It closed on{" "}
						{formatFullDate(detail.closedAt as Date)} and can’t be changed.
					</p>
				</InsetText>
			) : null}

			<section>
				<h2>Details</h2>
				<SummaryList rows={detailRows(detail, actions, href)} />
			</section>

			<section>
				<h2>Replacement steps</h2>
				<StepList steps={steps(detail)} />
			</section>

			<section>
				<h2>Bookings</h2>
				<Table
					caption="Bookings"
					captionHidden
					empty="No bookings yet."
					columns={[
						{ key: "when", header: "Session" },
						{ key: "status", header: "Status" },
						{ key: "by", header: "Booked by" },
						{ key: "on", header: "Booked on" },
					]}
					rows={detail.bookings.map((booking) => ({
						id: booking.id,
						cells: {
							when: `${booking.sessionId ? "" : "Custom appointment: "}${formatShortDay(booking.date, { year: true })}, ${formatTime(booking.time)}`,
							status: <BookingStatusTag status={booking.status} />,
							by: booking.bookedBy,
							on: formatShortDate(booking.bookedAt),
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
						tag: entry.failed ? <Tag colour="red">Failed</Tag> : undefined,
					}))}
					noteAction={detail.archived ? undefined : addCaseNote.bind(null, reference)}
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

function detailRows(detail: CaseDetail, actions: CaseAction[], href: string) {
	const { person, booking, oldDevice } = detail;
	return [
		{ key: "Email", value: person.email },
		{ key: "Username", value: person.username ?? "–" },
		{ key: "Job title", value: person.jobTitle ?? "–" },
		{ key: "Department", value: person.department ?? "–" },
		...(detail.assignedUser
			? [{ key: "Assigned user in Halo", value: detail.assignedUser }]
			: []),
		{
			key: "Type",
			value: detail.type === "collection" ? "Collection" : "Session",
			actions: actions.includes("change-type")
				? [{ href: `${href}/change-type`, visuallyHiddenText: "type" }]
				: undefined,
		},
		{
			key: "Booking",
			value: booking ? (
				<>
					{formatLongDate(booking.date, { year: true })}, {formatTime(booking.time)}
					<SummaryListSecondary>{booking.location}</SummaryListSecondary>
				</>
			) : (
				"Not booked"
			),
		},
		{
			key: "Software requested",
			value: booking
				? booking.software.length > 0
					? booking.software.join(", ")
					: "None"
				: "–",
		},
		{
			key: "Old device",
			value: (
				<>
					Asset {oldDevice.assetId}
					<SummaryListSecondary>
						{[oldDevice.serial, oldDevice.hostname].filter(Boolean).join(" · ")}
					</SummaryListSecondary>
				</>
			),
		},
		{
			key: "Old device returned",
			value: detail.progress.returnedAt ? (
				<>
					{formatFullDate(detail.progress.returnedAt)}
					{detail.progress.returnedBy ? (
						<SummaryListSecondary>
							Recorded by {detail.progress.returnedBy}
						</SummaryListSecondary>
					) : null}
				</>
			) : (
				"Not yet"
			),
		},
		...(detail.withdrawnReason
			? [{ key: "Withdrawn because", value: detail.withdrawnReason }]
			: []),
	];
}

/**
 * The six steps with their status and what has been done. Working the
 * steps (allocating, checklists, completing) comes with the next stage.
 */
function steps(detail: CaseDetail): Step[] {
	const { progress, step, boxNumber, booking } = detail;
	const closed = step === null;
	const by = (who: string | null, at: Date | null) =>
		at ? `${formatFullDate(at)}${who ? `, by ${who}` : ""}` : "";
	const summaries = [
		boxNumber
			? `Box number ${boxNumber} is allocated to this case${progress.allocatedAt ? ` (${by(progress.allocatedBy, progress.allocatedAt)})` : ""}.`
			: "No device is allocated yet.",
		progress.devicePreparedAt
			? `Device prepared on ${by(progress.devicePreparedBy, progress.devicePreparedAt)}.`
			: boxNumber
				? `Preparation checks for box ${boxNumber} are not confirmed yet.`
				: "Available after a device is allocated.",
		progress.softwarePreparedAt
			? `Software prepared on ${by(progress.softwarePreparedBy, progress.softwarePreparedAt)}.`
			: booking
				? booking.software.length > 0
					? `To install: ${booking.software.join(", ")}.`
					: "No software was requested."
				: "Waiting for the person to choose their software when they book.",
		progress.attendedAt
			? `Completed on ${formatFullDate(progress.attendedAt)}. Halo was updated and the new device issued.`
			: "Records attendance and updates Halo. Needs an allocated device.",
		progress.returnedAt
			? `Old device returned on ${by(progress.returnedBy, progress.returnedAt)}.`
			: "Available after the replacement is completed.",
		progress.decommissionedAt
			? `Decommissioned on ${by(progress.decommissionedBy, progress.decommissionedAt)}.`
			: "Available after the old device is returned.",
	];
	return STEP_TITLES.map((title, index) => {
		const number = index + 1;
		const status =
			detail.status === "completed" || (!closed && step !== null && number < step)
				? "done"
				: number === step
					? "current"
					: "not-started";
		return { id: `step-${number}`, title, status, content: <p>{summaries[index]}</p> };
	});
}

function actionItems(detail: CaseDetail, actions: CaseAction[], href: string): ActionListItem[] {
	const first = detail.person.firstName;
	const items: Record<CaseAction, ActionListItem | null> = {
		"resend-booking": {
			text: "Resend booking details",
			href: `${href}/resend-booking`,
			description: `Emails the current booking to ${first} again`,
		},
		"resend-invitation": {
			text: "Resend invitation",
			href: `${href}/resend-invitation`,
			description:
				detail.status === "unbooked"
					? "Back to Pending, with reminders restarting"
					: "The same invitation, with the booking link",
		},
		"cancel-booking": {
			text: "Cancel booking",
			href: `${href}/cancel-booking`,
			description: `${first} will be asked to rebook`,
		},
		"did-not-attend": {
			text: "Record did not attend",
			href: `${href}/did-not-attend`,
			description: `If ${first} missed the session or it was unsuccessful`,
		},
		flag: {
			text: "Flag case",
			href: `${href}/flag`,
			description: "With a reason, for the team",
		},
		"clear-flag": {
			text: "Clear flag",
			href: `${href}/clear-flag`,
			description: "Once it has been dealt with",
		},
		"change-type": null,
		withdraw: {
			text: "Withdraw case",
			href: `${href}/withdraw`,
			description: "Closes the case with a reason",
			destructive: true,
		},
	};
	return actions
		.map((action) => items[action])
		.filter((item): item is ActionListItem => Boolean(item));
}

const DONE: Record<string, (first: string) => [string, string?]> = {
	"resend-booking": (first) => [`Booking details sent to ${first}`],
	"resend-invitation": (first) => [`Invitation sent to ${first}`],
	"cancel-booking": (first) => [
		`${first}’s booking has been cancelled`,
		"They have been emailed to book a new time.",
	],
	"did-not-attend": () => [
		"The booking has been updated",
		"They have been emailed to book a new date.",
	],
	flag: () => ["Case flagged"],
	"clear-flag": () => ["Flag cleared"],
	"change-type": () => ["Type changed"],
	withdraw: () => ["Case withdrawn", "Nothing was sent to the person."],
};

function DoneBanner({ action, detail }: { action: string; detail: CaseDetail }) {
	const text = DONE[action]?.(detail.person.firstName);
	if (!text) return null;
	return (
		<NotificationBanner variant="success" heading={text[0]}>
			{text[1] ? <NotificationBannerDetail>{text[1]}</NotificationBannerDetail> : null}
		</NotificationBanner>
	);
}
