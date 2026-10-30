"use client";

import { useActionState } from "react";
import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { Button, ButtonGroup } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Link } from "@/components/ui/link";
import { NotificationBanner, NotificationBannerDetail } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { Radios } from "@/components/ui/radios";
import { SummaryList } from "@/components/ui/summary-list";
import { Textarea } from "@/components/ui/textarea";
import type { CaseAction } from "@/services/replacements/laptops/lib/cases";
import { type CaseActionState, runCaseAction } from "../../actions";

/** What a confirmation page needs to say, worked out on the server. */
export type ConfirmData = {
	reference: string;
	name: string;
	firstName: string;
	email: string;
	serial: string | null;
	type: ReplacementType;
	status: string;
	/** "Thursday 12 November 2026 at 9:30am". */
	bookingWhen: string | null;
	bookingWhere: string | null;
	software: string[] | null;
	boxNumber: string | null;
	flagReason: string | null;
	caseHref: string;
};

/**
 * Each case action's confirmation page (mockups: AdminAct…): the question as
 * the heading, what will happen, the action button and "Go back". The
 * mockups use "she" and "her" in places; we can't know anyone's pronouns,
 * so these say "they" and "their".
 */
export function ConfirmAction({ action, data }: { action: CaseAction; data: ConfirmData }) {
	const [state, formAction, pending] = useActionState<CaseActionState, FormData>(
		runCaseAction.bind(null, data.reference, action),
		{},
	);
	const { firstName, name } = data;
	const caption = `Case ${data.reference} · ${name}`;
	const fieldError = state.field ? state.error : undefined;

	const back = <Link href={data.caseHref}>Go back</Link>;
	const submit = (text: string, warning = false) => (
		<ButtonGroup>
			<Button
				type="submit"
				variant={warning ? "warning" : "primary"}
				aria-disabled={pending || undefined}
			>
				{text}
			</Button>
			{back}
		</ButtonGroup>
	);

	return (
		<form action={formAction}>
			{state.error && !state.field ? (
				<NotificationBanner
					variant="failed"
					heading={state.emailFailed ? "The email was not sent" : "That didn’t work"}
				>
					<NotificationBannerDetail>
						{state.error}
						{state.emailFailed ? " The attempt is in the case journal." : ""}
					</NotificationBannerDetail>
				</NotificationBanner>
			) : null}
			<ErrorSummary
				errors={
					state.field && state.error ? [{ fieldId: state.field, text: state.error }] : []
				}
			/>
			{body()}
		</form>
	);

	function body() {
		switch (action) {
			case "resend-booking":
				return (
					<>
						<PageHeading
							caption={caption}
							title={`Are you sure you want to resend ${firstName}’s booking details?`}
						/>
						<p>
							This email will be sent to {data.email} and contain the following
							details:
						</p>
						<SummaryList
							rows={[
								{
									key: "Type",
									value: data.type === "collection" ? "Collection" : "Session",
								},
								{ key: "Date and time", value: data.bookingWhen ?? "–" },
								{ key: "Location", value: data.bookingWhere ?? "–" },
								{
									key: "Software",
									value:
										data.software && data.software.length > 0
											? data.software.join(", ")
											: "None",
								},
							]}
						/>
						<p>
							It also includes a link {firstName} can use to rebook or change their
							software.
						</p>
						{submit("Send email")}
					</>
				);
			case "resend-invitation":
				return (
					<>
						<PageHeading
							caption={caption}
							title={`Are you sure you want to resend ${firstName}’s invitation?`}
						/>
						<p>
							This email will be sent to {data.email} and contain a link to book a
							time to replace their laptop
							{data.serial ? ` (serial ${data.serial})` : ""}.
						</p>
						{data.bookingWhen ? (
							<p>
								{firstName} is already booked for {data.bookingWhen}. If they use
								the link, they will be rebooking rather than making a new booking.
							</p>
						) : null}
						{data.status === "unbooked" ? (
							<p>
								The case goes back to Pending, the “Unavailable for sessions” flag
								is cleared and weekly reminders start again.
							</p>
						) : null}
						<p>
							It is the same invitation email {firstName} was sent before. Their
							booking link never expires.
						</p>
						{submit("Send email")}
					</>
				);
			case "cancel-booking":
				return (
					<>
						<PageHeading
							caption={caption}
							title={`Are you sure you want to cancel ${firstName}’s booking?`}
						/>
						<p>
							{firstName}’s booking for {data.bookingWhen} will be cancelled. They
							will be emailed and asked to book a new time to replace their device.
						</p>
						<p>
							If you want to remove {firstName} from the system, you need to{" "}
							<Link href={`${data.caseHref}/withdraw`}>withdraw their case</Link>.
						</p>
						<p>
							The case moves to Rebook required and weekly rebook reminders start.
							{data.boxNumber
								? ` Box ${data.boxNumber} stays allocated to this case.`
								: ""}
						</p>
						{submit("Cancel booking", true)}
					</>
				);
			case "did-not-attend":
				return (
					<>
						<Radios
							name="outcome"
							idPrefix="outcome"
							legend={`What happened at ${firstName}’s session?`}
							caption={caption}
							isPageHeading
							legendSize="l"
							hint={[data.bookingWhen, data.bookingWhere].filter(Boolean).join(", ")}
							error={state.field === "outcome" ? fieldError : undefined}
							items={[
								{ value: "did_not_attend", label: "Did not attend" },
								{
									value: "unsuccessful",
									label: "Unsuccessful",
									hint: "They came, but the replacement could not be finished, for example a device fault",
								},
							]}
						/>
						<Textarea
							id="reason"
							name="reason"
							label="Reason (optional)"
							hint={`Saved in the case journal. ${firstName} will not see it.`}
							maxLength={500}
						/>
						<p>
							The booking is marked and the case moves to Rebook required. {firstName}{" "}
							is emailed to book a new date, and weekly reminders start again.
							{data.boxNumber
								? ` Box ${data.boxNumber} stays allocated to the case.`
								: ""}
						</p>
						{submit("Save")}
					</>
				);
			case "flag":
				return (
					<>
						<Textarea
							id="reason"
							name="reason"
							label={`Why are you flagging ${firstName}’s case?`}
							caption={caption}
							isPageHeading
							labelSize="l"
							hint={`The flag and its reason show on the case and in the Cases list, and are saved in the journal. ${firstName} will not see them.`}
							error={state.field === "reason" ? fieldError : undefined}
							maxLength={500}
						/>
						<p>
							You can only flag a case before it is booked. Anyone in the team can
							clear the flag once it has been dealt with. Flagging does not pause
							reminders or change the case status.
						</p>
						{submit("Flag case")}
					</>
				);
			case "clear-flag":
				return (
					<>
						<PageHeading
							caption={caption}
							title={`Are you sure you want to clear the flag on ${firstName}’s case?`}
						/>
						<p>Flagged: {data.flagReason ?? "no reason given"}.</p>
						<p>
							Clearing it is saved in the journal. It doesn’t change the case status
							or reminders.
						</p>
						{submit("Clear flag")}
					</>
				);
			case "change-type":
				return (
					<>
						<Radios
							name="type"
							legend={`Change type for ${name}`}
							caption={caption}
							isPageHeading
							legendSize="l"
							hint={`The type decides which dates ${firstName} can book.`}
							error={state.field === "type" ? fieldError : undefined}
							value={data.type}
							items={[
								{
									value: "collection",
									label: "Collection",
									hint: "They pick up a laptop that is already set up",
								},
								{
									value: "session",
									label: "Session",
									hint: "An engineer sets up the laptop with them",
								},
							]}
						/>
						{submit("Save")}
					</>
				);
			case "withdraw":
				return (
					<>
						<PageHeading
							caption={caption}
							title={`Are you sure you want to withdraw ${firstName}’s replacement?`}
						/>
						<p>
							This will remove {firstName} from the system and they will not be able
							to replace their device. No communications will be sent to {firstName}.
						</p>
						<p>
							{data.bookingWhen
								? `${firstName}’s booking on ${data.bookingWhen} is cancelled`
								: "There is no booking to cancel"}
							{data.boxNumber
								? ` and box ${data.boxNumber} goes back into stock`
								: ""}
							. The case is kept as Withdrawn and archived after one month.
						</p>
						<Textarea
							id="reason"
							name="reason"
							label="Reason for withdrawing"
							hint={`This is saved in the case journal. ${firstName} will not see it.`}
							error={state.field === "reason" ? fieldError : undefined}
							maxLength={500}
						/>
						{submit("Withdraw case", true)}
					</>
				);
		}
	}
}
