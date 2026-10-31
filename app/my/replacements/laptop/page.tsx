import type { Metadata } from "next";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { Button } from "@/components/ui/button";
import { Details } from "@/components/ui/details";
import { Markdown } from "@/components/ui/markdown";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { requireUser } from "@/lib/auth/guards";
import { formatLongDate } from "@/lib/dates/format";
import { fillVariables } from "@/lib/emails/render";
import {
	bookingSettings,
	softwareChangeDeadline,
	softwareList,
	softwareLocked,
	splitSoftware,
} from "@/services/replacements/laptops/lib/booking";
import { getEmailSender } from "@/services/replacements/laptops/lib/emails/settings";
import { faqs, myCase, pageContent } from "@/services/replacements/laptops/lib/my-laptop";
import { variableValues } from "@/services/replacements/laptops/lib/variables";
import { LAPTOP_PAGE, TYPE_WORDS, when, withCase } from "./wording";

export const metadata: Metadata = { title: "Your laptop replacement" };

type LaptopPageProps = { searchParams: Promise<{ case?: string; done?: string }> };

const DONE: Record<string, string> = {
	booked: "Booking confirmed",
	rebooked: "Your booking has been changed",
	software: "Your software has been saved",
};

/** Mockups: UserBooked, UserSoftwareLocked. Colleagues never see the case reference. */
export default async function LaptopPage({ searchParams }: LaptopPageProps) {
	const user = await requireUser();
	const { case: token, done } = await searchParams;
	const found = await myCase(user.id, token);

	if (!found) {
		return (
			<ColleaguePage>
				<PageHeading caption="Device portal" title="Your laptop replacement" />
				<p>You do not have a laptop replacement due. We will email you when you do.</p>
			</ColleaguePage>
		);
	}

	const words = TYPE_WORDS[found.type];
	const { booking } = found;
	const q = withCase(token);

	if (!booking) {
		return (
			<ColleaguePage>
				<PageHeading caption="Device portal" title="Your laptop replacement" />
				{found.status === "unbooked" && !found.lastCancelled ? (
					<p>
						We have your availability and the team will contact you to arrange a time.
						If one of the published dates becomes suitable, you can still book it
						yourself.
					</p>
				) : found.status === "awaiting_return" ||
					found.status === "awaiting_decommission" ? (
					<p>
						Your new laptop has been issued. Please return your old laptop to the team
						if you have not already.
					</p>
				) : (
					<p>
						Your laptop{found.serial ? `, serial number ${found.serial},` : ""} is no
						longer supported by the council and needs to be replaced. {words.book}
					</p>
				)}
				{["pending", "unbooked", "rebook_required"].includes(found.status) ? (
					<Button href={`${LAPTOP_PAGE}/book${q}`}>Book your laptop replacement</Button>
				) : null}
			</ColleaguePage>
		);
	}

	const [settings, list, content, questions, sender] = await Promise.all([
		bookingSettings(),
		softwareList(),
		pageContent(found.type),
		faqs(found.type),
		getEmailSender(),
	]);
	const locked = softwareLocked(booking.date, settings);
	const deadline = softwareChangeDeadline(booking.date, settings);
	const { listed, other } = splitSoftware(booking.software, list);
	const variables = variableValues("page", {
		firstName: found.person.firstName,
		fullName: found.person.fullName,
		username: found.person.username,
		caseReference: "",
		type: found.type,
		booking: { date: booking.date, startTime: booking.time, location: booking.location },
		bookingLink: null,
		oldSerial: found.serial,
		oldMake: found.make,
		oldModel: found.model,
		software: booking.software,
		teamName: sender.teamName,
	});

	return (
		<ColleaguePage>
			{done && DONE[done] ? (
				<NotificationBanner variant="success" heading={DONE[done]}>
					{done === "software" ? null : (
						<p>
							Your {words.name.toLowerCase()} is on {when(booking.date, booking.time)}
							. We have emailed a confirmation to {found.person.email}.
						</p>
					)}
				</NotificationBanner>
			) : null}
			<PageHeading caption="Book your laptop replacement" title="Your laptop replacement" />
			<p>
				You are booked in to replace your current laptop
				{found.serial ? ` (serial number ${found.serial})` : ""}.
			</p>

			<h2>Your booking</h2>
			<SummaryList
				rows={[
					{
						key: "Type",
						value: (
							<>
								{words.name}
								<SummaryListSecondary>{words.involves}</SummaryListSecondary>
							</>
						),
					},
					{
						key: "Date and time",
						value: when(booking.date, booking.time),
						actions:
							booking.sessionId && booking.startsAt > new Date()
								? [
										{
											href: `${LAPTOP_PAGE}/rebook${q}`,
											text: "Rebook",
											visuallyHiddenText: "date and time",
										},
									]
								: undefined,
					},
					{ key: "Location", value: booking.location },
					...(booking.note ? [{ key: "Note from the team", value: booking.note }] : []),
				]}
			/>
			<p>
				You cannot cancel your booking, but you can rebook at any time. Replacing your
				laptop is mandatory so that your device stays supported.
			</p>

			<h2>Software</h2>
			<SummaryList
				rows={[
					{
						key: "Software you need",
						value: listed.length ? listed.join(", ") : "None",
						actions: locked
							? undefined
							: [
									{
										href: `${LAPTOP_PAGE}/software${q}`,
										visuallyHiddenText: "software",
									},
								],
					},
					...(other.length ? [{ key: "Other software", value: other.join(", ") }] : []),
				]}
			/>
			{locked ? (
				<p>
					Your new laptop is being prepared, so you can no longer change your software
					here. If something is missing, the engineer can help at your{" "}
					{words.name.toLowerCase()}.
				</p>
			) : (
				<p className="bcp-secondary-text">
					You can change these until 11:59pm on {formatLongDate(deadline, { year: true })}
					.
				</p>
			)}

			{content ? <Markdown>{fillVariables(content, variables, "send")}</Markdown> : null}

			{questions.length > 0 ? (
				<section>
					<h2>Frequently asked questions</h2>
					{questions.map((faq) => (
						<Details key={faq.question} summary={faq.question}>
							<Markdown>{faq.answer}</Markdown>
						</Details>
					))}
				</section>
			) : null}
		</ColleaguePage>
	);
}
