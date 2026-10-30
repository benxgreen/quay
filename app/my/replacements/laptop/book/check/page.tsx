import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { requireUser } from "@/lib/auth/guards";
import { formatLongDate } from "@/lib/dates/format";
import {
	bookingSettings,
	offeredSessions,
	softwareChangeDeadline,
	softwareList,
	splitSoftware,
} from "@/services/replacements/laptops/lib/booking";
import { myCase } from "@/services/replacements/laptops/lib/my-laptop";
import { confirmBooking } from "../../actions";
import { LAPTOP_PAGE, TYPE_WORDS, when, withCase } from "../../wording";

export const metadata: Metadata = { title: "Check your answers before booking" };

type CheckPageProps = {
	searchParams: Promise<{ case?: string; session?: string; software?: string | string[] }>;
};

/** Mockups: UserCheckAnswers. */
export default async function CheckAnswersPage({ searchParams }: CheckPageProps) {
	const user = await requireUser();
	const { case: token, session: sessionId, software } = await searchParams;
	const found = await myCase(user.id, token);
	if (!found || found.booking || !sessionId) redirect(`${LAPTOP_PAGE}/book${withCase(token)}`);
	const [weeks, list, settings] = await Promise.all([
		offeredSessions(found.type),
		softwareList(),
		bookingSettings(),
	]);
	const session = weeks.flatMap((week) => week.sessions).find((s) => s.id === sessionId);
	if (!session)
		redirect(`${LAPTOP_PAGE}/book${withCase(token, { error: "full", session: sessionId })}`);
	const chosen = [software ?? []].flat();
	const { listed, other } = splitSoftware(chosen, list);
	const back = (page: string) =>
		`${LAPTOP_PAGE}/book${page}${withCase(token, { session: sessionId, software: chosen })}`;
	const words = TYPE_WORDS[found.type];

	return (
		<ColleaguePage backHref={back("/software")}>
			<PageHeading
				caption="Book your laptop replacement"
				title="Check your answers before booking"
			/>
			<h2>Your booking</h2>
			<SummaryList
				rows={[
					{
						key: "Laptop being replaced",
						value: found.serial ? `Serial ${found.serial}` : "–",
					},
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
						value: when(session.date, session.time),
						actions: [{ href: back(""), visuallyHiddenText: "date and time" }],
					},
					{ key: "Location", value: session.location },
				]}
			/>
			<h2>Software</h2>
			<SummaryList
				rows={[
					{
						key: "Software you need",
						value: listed.length ? listed.join(", ") : "None",
						actions: [
							{ href: back("/software"), visuallyHiddenText: "software you need" },
						],
					},
					{
						key: "Other software",
						value: other.length ? other.join(", ") : "None",
						actions: [
							{ href: back("/software"), visuallyHiddenText: "other software" },
						],
					},
				]}
			/>
			<h2>Confirm your booking</h2>
			<p>
				We will email a confirmation to {found.person.email}. You can change your software
				until 11:59pm on{" "}
				{formatLongDate(softwareChangeDeadline(session.date, settings), { year: true })},
				and rebook if the date stops working for you.
			</p>
			<form action={confirmBooking}>
				{token ? <input type="hidden" name="case" value={token} /> : null}
				<input type="hidden" name="session" value={sessionId} />
				{chosen.map((name) => (
					<input key={name} type="hidden" name="software" value={name} />
				))}
				<Button type="submit">Confirm booking</Button>
			</form>
		</ColleaguePage>
	);
}
