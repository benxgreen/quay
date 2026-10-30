import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { SessionChoice } from "@/components/service/replacements/session-choice";
import { Button, ButtonGroup } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Link } from "@/components/ui/link";
import { offeredSessions } from "@/services/replacements/laptops/lib/booking";
import { teamChooseDate } from "../../booking-actions";
import { loadForBooking } from "./load";

export const metadata: Metadata = { title: "Book on behalf" };

type Props = {
	params: Promise<{ reference: string }>;
	searchParams: Promise<{ error?: string; session?: string }>;
};

/** Mockups: AdminBookDate. The team can book inside the lead time. */
export default async function BookOnBehalfPage({ params, searchParams }: Props) {
	const { detail, href, crumbs, caption } = await loadForBooking((await params).reference);
	const { error, session } = await searchParams;
	const weeks = await offeredSessions(detail.type, {
		forTeam: true,
		exclude: detail.booking?.sessionId,
	});
	const typeWord = detail.type === "collection" ? "collection" : "session";
	const message =
		error === "full"
			? "That date is now full. Choose another date"
			: error
				? "Choose a date and time"
				: undefined;

	return (
		<LaptopsPage section="cases" parents={crumbs} narrow>
			<ErrorSummary errors={message ? [{ fieldId: "session", text: message }] : []} />
			<form action={teamChooseDate.bind(null, detail.reference)}>
				<SessionChoice
					weeks={weeks}
					legend={`Choose a ${typeWord} for ${detail.person.name}`}
					caption={caption}
					hint={
						detail.booking
							? "Choosing a date rebooks them straight away, keeping their software."
							: `You can book any published ${typeWord}, including ones less than the lead time away.`
					}
					error={message}
					full={error === "full" && session ? [session] : []}
				/>
				<ButtonGroup>
					<Button type="submit">{detail.booking ? "Rebook" : "Continue"}</Button>
					<Link href={href}>Cancel</Link>
				</ButtonGroup>
			</form>
			{detail.status === "unbooked" ? (
				<p>
					None of these suit {detail.person.firstName}?{" "}
					<Link href={`${href}/custom-appointment`}>
						Set a custom date and time instead
					</Link>
					.
				</p>
			) : null}
		</LaptopsPage>
	);
}
