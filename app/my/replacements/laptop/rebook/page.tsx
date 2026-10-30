import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { SessionChoice } from "@/components/service/replacements/session-choice";
import { Button } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { InsetText } from "@/components/ui/inset-text";
import { requireUser } from "@/lib/auth/guards";
import { offeredSessions, sessionLabel } from "@/services/replacements/laptops/lib/booking";
import { myCase } from "@/services/replacements/laptops/lib/my-laptop";
import { chooseNewDate } from "../actions";
import { LAPTOP_PAGE, when, withCase } from "../wording";

export const metadata: Metadata = { title: "Choose a new date and time" };

type RebookPageProps = {
	searchParams: Promise<{ case?: string; error?: string; session?: string }>;
};

/**
 * Mockups: UserRebook. Ends with "or" and "I am not available for any of
 * these dates", which cancels the booking and moves the case to Unbooked
 * with reminders paused.
 */
export default async function RebookPage({ searchParams }: RebookPageProps) {
	const user = await requireUser();
	const { case: token, error, session } = await searchParams;
	const found = await myCase(user.id, token);
	const back = `${LAPTOP_PAGE}${withCase(token)}`;
	if (!found?.booking?.sessionId || found.booking.startsAt <= new Date()) redirect(back);
	const weeks = await offeredSessions(found.type, { exclude: found.booking.sessionId });
	const chosen = weeks.flatMap((week) => week.sessions).find((s) => s.id === session);
	const message =
		error === "full"
			? `${chosen ? sessionLabel(chosen) : "That date"} is now full. Choose another date`
			: error === "choose"
				? "Choose a new date and time, or tell us you are not available"
				: undefined;

	return (
		<ColleaguePage backHref={back}>
			<ErrorSummary errors={message ? [{ fieldId: "session", text: message }] : []} />
			<InsetText>
				<p>
					Your current booking is on{" "}
					<strong>{when(found.booking.date, found.booking.time)}</strong>. It stays booked
					until you change it.
				</p>
			</InsetText>
			<form action={chooseNewDate}>
				{token ? <input type="hidden" name="case" value={token} /> : null}
				<SessionChoice
					weeks={weeks}
					legend="Choose a new date and time"
					caption="Change your booking"
					error={message}
					full={error === "full" && session ? [session] : []}
					after={[
						{ divider: "or" },
						{
							value: "not-available",
							label: "I am not available for any of these dates",
							hint: "Your booking is cancelled and your software choices are kept. Book again when a date suits you.",
						},
					]}
				/>
				<Button type="submit">Continue</Button>
			</form>
		</ColleaguePage>
	);
}
