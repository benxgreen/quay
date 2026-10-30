import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { SessionChoice } from "@/components/service/replacements/session-choice";
import { Button } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Link } from "@/components/ui/link";
import { requireUser } from "@/lib/auth/guards";
import { offeredSessions, sessionLabel } from "@/services/replacements/laptops/lib/booking";
import { myCase, previousSoftware } from "@/services/replacements/laptops/lib/my-laptop";
import { chooseDate } from "../actions";
import { LAPTOP_PAGE, TYPE_WORDS, withCase } from "../wording";

export const metadata: Metadata = { title: "Choose a date and time" };

type BookPageProps = { searchParams: Promise<{ case?: string; error?: string; session?: string }> };

/** Mockups: UserChooseDate, UserSessionFull. The lead time is applied, not explained. */
export default async function ChooseDatePage({ searchParams }: BookPageProps) {
	const user = await requireUser();
	const { case: token, error, session } = await searchParams;
	const found = await myCase(user.id, token);
	if (
		!found ||
		found.booking ||
		!["pending", "unbooked", "rebook_required"].includes(found.status)
	) {
		redirect(`${LAPTOP_PAGE}${withCase(token)}`);
	}
	const [weeks, software] = await Promise.all([
		offeredSessions(found.type),
		previousSoftware(found.id),
	]);
	const chosen = weeks.flatMap((week) => week.sessions).find((s) => s.id === session);
	const message =
		error === "full"
			? `${chosen ? sessionLabel(chosen) : "That date"} is now full. Choose another date`
			: error === "choose"
				? "Choose a date and time"
				: undefined;

	return (
		<ColleaguePage backHref={`${LAPTOP_PAGE}${withCase(token)}`}>
			<ErrorSummary errors={message ? [{ fieldId: "session", text: message }] : []} />
			<form action={chooseDate}>
				{token ? <input type="hidden" name="case" value={token} /> : null}
				{software.map((name) => (
					<input key={name} type="hidden" name="keep" value={name} />
				))}
				{weeks.length > 0 ? (
					<SessionChoice
						weeks={weeks}
						legend="Choose a date and time"
						caption="Book your laptop replacement"
						hint={TYPE_WORDS[found.type].choose}
						error={message}
						full={error === "full" && session ? [session] : []}
					/>
				) : (
					<>
						<h1>Choose a date and time</h1>
						<p>
							There are no dates to book at the moment. We will email you when there
							are.
						</p>
					</>
				)}
				{weeks.length > 0 ? <Button type="submit">Continue</Button> : null}
			</form>
			<h2>If you cannot attend any of these dates</h2>
			<p>
				If you work non-standard days or hours, or you are away for all of the dates,{" "}
				<Link href={`${LAPTOP_PAGE}/availability${withCase(token)}`}>
					tell us when you are available
				</Link>
				.
			</p>
		</ColleaguePage>
	);
}
