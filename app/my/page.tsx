import type { Metadata } from "next";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { NotificationBanner, NotificationBannerDetail } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { Standout } from "@/components/ui/standout";
import { requireUser } from "@/lib/auth/guards";
import { formatLongDate } from "@/lib/dates/format";
import { type MyCase, myCase } from "@/services/replacements/laptops/lib/my-laptop";
import { LAPTOP_PAGE, TYPE_WORDS, when, withCase } from "./replacements/laptop/wording";

export const metadata: Metadata = { title: "Your devices" };

/**
 * The portal home (mockups: UserHome, UserCancelled, UserSessionCancelled).
 * Manager views of direct reports wait for manager details from Halo.
 */
export default async function YourDevicesPage({
	searchParams,
}: {
	searchParams: Promise<{ case?: string }>;
}) {
	const user = await requireUser();
	const { case: token } = await searchParams;
	const found = await myCase(user.id, token);
	const toDo = found ? thingToDo(found) : null;

	return (
		<ColleaguePage>
			{found?.lastCancelled ? <CancelledBanner found={found} /> : null}
			<PageHeading caption="Device portal" title="Your devices" />
			<p>
				{toDo
					? "You have 1 thing to do."
					: "You have nothing to do right now. We will email you when you do."}
			</p>

			{found ? (
				<Standout>
					<LaptopPanel found={found} token={token} />
				</Standout>
			) : null}

			<h2>Find support for your council equipment</h2>
			<p>
				Support can be accessed via the{" "}
				<Link href="https://halohub.bcpcouncil.gov.uk">Halo Hub</Link> or by calling the{" "}
				<Link href="tel:01202096666">ICT Service Desk</Link>.
			</p>
		</ColleaguePage>
	);
}

/** Waiting on the colleague: book, rebook or return the old laptop. */
function thingToDo(found: MyCase): boolean {
	if (["pending", "rebook_required", "awaiting_return"].includes(found.status)) return true;
	return found.status === "unbooked" && found.lastCancelled !== null;
}

function CancelledBanner({ found }: { found: MyCase }) {
	const last = found.lastCancelled;
	if (!last) return null;
	const day = formatLongDate(last.date);
	const [heading, detail] =
		last.reason === "session_cancelled"
			? [
					`We have had to cancel your session on ${day}`,
					"Sorry for the inconvenience. Please choose a new date. Your software choices have been kept.",
				]
			: last.reason === "not_available"
				? [
						`Your session on ${day} has been cancelled`,
						"Book a new date when one suits you.",
					]
				: last.reason === "team"
					? [`Your booking on ${day} has been cancelled`, "Please choose a new date."]
					: [
							`You need to choose a new date`,
							`Your replacement on ${day} did not go ahead.`,
						];
	return (
		<NotificationBanner variant="important" heading={heading}>
			<NotificationBannerDetail>{detail}</NotificationBannerDetail>
		</NotificationBanner>
	);
}

function LaptopPanel({ found, token }: { found: MyCase; token?: string }) {
	const q = withCase(token);
	const words = TYPE_WORDS[found.type];
	if (found.booking) {
		return (
			<section>
				<h2>Your laptop replacement</h2>
				<p>
					Your {words.name.toLowerCase()} is on{" "}
					{when(found.booking.date, found.booking.time)} at {found.booking.location}.
				</p>
				<Button href={`${LAPTOP_PAGE}${q}`} variant="secondary">
					View your booking
				</Button>
			</section>
		);
	}
	if (found.status === "awaiting_return" || found.status === "awaiting_decommission") {
		return (
			<section>
				<h2>Return your old laptop</h2>
				<p>Your new laptop has been issued. Please return your old laptop to the team.</p>
			</section>
		);
	}
	return (
		<section>
			<h2>You need to replace your laptop</h2>
			<p>
				Your laptop
				{found.serial ? (
					<>
						, serial number <strong>{found.serial}</strong>,
					</>
				) : null}{" "}
				is no longer supported by the council and needs to be replaced.
			</p>
			<p>
				{found.lastCancelled?.reason === "session_cancelled"
					? `Your session was cancelled, so you need to choose a new date.`
					: words.book}
			</p>
			<Button href={`${LAPTOP_PAGE}/book${q}`}>
				{found.lastCancelled ? "Choose a new date" : "Book your laptop replacement"}
			</Button>
		</section>
	);
}
