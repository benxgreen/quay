import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkboxes";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { SummaryList } from "@/components/ui/summary-list";
import { formatLongDate, formatTime } from "@/lib/dates/format";
import { offeredSessions } from "@/services/replacements/laptops/lib/booking";
import { teamConfirmBooking } from "../../../booking-actions";
import { loadForBooking } from "../load";

export const metadata: Metadata = { title: "Check the booking" };

type Props = {
	params: Promise<{ reference: string }>;
	searchParams: Promise<{ session?: string; software?: string | string[] }>;
};

/** Mockups: AdminBookCheck. */
export default async function BookCheckPage({ params, searchParams }: Props) {
	const { detail, href, crumbs, caption } = await loadForBooking((await params).reference);
	const { session: sessionId, software } = await searchParams;
	const weeks = await offeredSessions(detail.type, { forTeam: true });
	const session = weeks.flatMap((w) => w.sessions).find((s) => s.id === sessionId);
	if (!session) redirect(`${href}/book?error=full&session=${sessionId ?? ""}`);
	const chosen = [software ?? []].flat();
	const typeWord = detail.type === "collection" ? "Collection" : "Session";

	return (
		<LaptopsPage section="cases" parents={crumbs} narrow>
			<PageHeading caption={caption} title="Check the booking" />
			<SummaryList
				rows={[
					{
						key: "Case",
						value: `${detail.reference} · ${detail.person.name}, ${detail.person.email}`,
					},
					...(detail.assignedUser
						? [{ key: "Assigned user in Halo", value: detail.assignedUser }]
						: []),
					{ key: "Type", value: typeWord },
					{
						key: "Date and time",
						value: `${formatLongDate(session.date, { year: true })} at ${formatTime(session.time)}`,
						actions: [{ href: `${href}/book`, visuallyHiddenText: "date and time" }],
					},
					{ key: "Location", value: session.location },
					{ key: "Software", value: chosen.length ? chosen.join(", ") : "None yet" },
				]}
			/>
			<form action={teamConfirmBooking.bind(null, detail.reference)}>
				<input type="hidden" name="session" value={session.id} />
				{chosen.map((name) => (
					<input key={name} type="hidden" name="software" value={name} />
				))}
				<Checkbox
					id="email"
					name="email"
					value="yes"
					defaultChecked
					label={`Email the booking confirmation to ${detail.person.firstName}`}
				/>
				<p>
					No invitation is sent. The case moves straight to Booked and reminders follow as
					normal.
				</p>
				<ButtonGroup>
					<Button type="submit">Book {typeWord.toLowerCase()}</Button>
					<Link href={href}>Cancel</Link>
				</ButtonGroup>
			</form>
		</LaptopsPage>
	);
}
