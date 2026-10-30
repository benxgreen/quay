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
import {
	availableActions,
	type CaseAction,
	type CaseDetail,
	getCase,
} from "@/services/replacements/laptops/lib/cases";
import { getStepData } from "@/services/replacements/laptops/lib/steps";
import { availableDevices } from "@/services/replacements/laptops/lib/stock";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { addCaseNote } from "../actions";
import { CaseSteps } from "./case-steps";

const BASE = LAPTOPS_SECTIONS.cases.href;

type CasePageProps = {
	params: Promise<{ reference: string }>;
	searchParams: Promise<{
		done?: string;
		noteError?: string;
		step?: string;
		stepError?: string;
		failed?: string;
		message?: string;
		at?: string;
	}>;
};

export async function generateMetadata({ params }: CasePageProps): Promise<Metadata> {
	const { reference } = await params;
	const detail = await getCase(reference);

	return {
		title: detail ? `Case ${detail.reference} – ${detail.person.name}` : `Case ${reference}`,
	};
}

/** Mockups: AdminCase and its stages, AdminCaseArchived. */
export default async function CasePage({ params, searchParams }: CasePageProps) {
	const user = await requireRole(ACCESS.laptops);
	const { reference } = await params;
	const detail = await getCase(reference);
	if (!detail) notFound();
	const { done, noteError, step: stepDone, stepError, failed, message, at } = await searchParams;
	const [stepData, devices] = await Promise.all([
		getStepData(detail),
		!detail.archived && detail.step === 1 ? availableDevices(user.id) : [],
	]);
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
			{stepDone ? <StepBanner done={stepDone} detail={detail} /> : null}
			{stepError ? (
				<NotificationBanner variant="important" heading="Not done yet">
					<NotificationBannerDetail>{stepError}</NotificationBannerDetail>
				</NotificationBanner>
			) : null}
			{failed ? (
				<FailedBanner action={failed} message={message} at={at} detail={detail} />
			) : null}
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

			<section id="steps">
				<h2>Replacement steps</h2>
				<CaseSteps detail={detail} data={stepData} devices={devices} />
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
	const canChange = !detail.archived && detail.status === "booked";
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
			actions:
				booking && canChange
					? [{ href: `${href}/book`, visuallyHiddenText: "booking" }]
					: undefined,
		},
		{
			key: "Software requested",
			value: booking
				? booking.software.length > 0
					? booking.software.join(", ")
					: "None"
				: "–",
			actions:
				booking && canChange
					? [{ href: `${href}/software`, visuallyHiddenText: "software requested" }]
					: undefined,
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
		"book-on-behalf": {
			text: "Book on behalf",
			href: `${href}/book`,
			description: `Choose a date and software for ${first}`,
		},
		"custom-appointment": {
			text: "Book a custom appointment",
			href: `${href}/custom-appointment`,
			description: "A date, time and place agreed with them",
		},
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
	booked: (first) => [`Booked for ${first}`],
	rebooked: (first) => [`${first} has been rebooked`],
	custom: () => ["Custom appointment booked"],
	software: () => ["Software saved"],
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

const STEP_DONE: Record<string, (detail: CaseDetail) => [string, string?]> = {
	allocated: (d) => [
		`Box ${d.boxNumber} allocated to this case`,
		"Halo hasn’t been changed yet.",
	],
	unallocated: () => ["Device unallocated", "It is back in stock, and the case is on step 1."],
	"prep-saved": () => ["Preparation checks saved"],
	prepared: () => ["Device prepared"],
	"software-saved": () => ["Software saved"],
	"software-prepared": () => ["Software prepared"],
	"reopened-2": () => ["Device preparation reopened", "Your ticks are kept."],
	"reopened-3": () => ["Software reopened", "Your ticks are kept."],
	"checklist-updated": () => ["Checklist updated to the latest list"],
	completed: (d) => [
		"Replacement completed",
		`Halo has been updated and ${d.person.firstName} has been sent the Device issued email.`,
	],
	"reminders-saved": () => ["Reminder setting saved"],
	returned: () => [
		"Old device marked as returned",
		"Halo has been updated. Next, the decommission checklist.",
	],
	"decom-saved": () => ["Decommission checks saved"],
	decommissioned: () => ["Replacement complete. The case is now closed."],
};

function StepBanner({ done, detail }: { done: string; detail: CaseDetail }) {
	const text = STEP_DONE[done]?.(detail);
	if (!text) return null;
	return (
		<NotificationBanner variant="success" heading={text[0]}>
			{text[1] ? <NotificationBannerDetail>{text[1]}</NotificationBannerDetail> : null}
		</NotificationBanner>
	);
}

/** When Halo or the decommission call failed (mockups: AdminCaseHaloFailed, AdminCaseHookFailed). */
function FailedBanner({
	action,
	message,
	at,
	detail,
}: {
	action: string;
	message?: string;
	at?: string;
	detail: CaseDetail;
}) {
	const texts: Record<string, [string, string]> = {
		complete: [
			"Replacement not completed",
			`Halo could not be updated, so nothing has been changed. Box ${detail.boxNumber} is still in stock in Halo and the case is still on step 4.`,
		],
		returned: [
			"Old device not marked as returned",
			"Halo could not be updated, so nothing has been changed. The case is still on step 5.",
		],
		decommission: [
			"Old device not decommissioned",
			"The decommission call did not succeed, so nothing has been changed. Your ticks are saved and the case is still on step 6.",
		],
	};
	const text = texts[action];
	if (!text) return null;
	const when =
		at && !Number.isNaN(Date.parse(at)) ? ` at ${formatShortDateTime(new Date(at))}` : "";
	return (
		<NotificationBanner variant="failed" heading={text[0]}>
			<NotificationBannerDetail>{text[1]}</NotificationBannerDetail>
			{message ? (
				<NotificationBannerDetail>
					{message}
					{when}.
				</NotificationBannerDetail>
			) : null}
			<NotificationBannerDetail>
				Try again. If it keeps failing, check the connection in Settings. The attempt is in
				the case journal.
			</NotificationBannerDetail>
		</NotificationBanner>
	);
}
