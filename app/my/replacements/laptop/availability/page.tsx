import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { SoftwareChoice } from "@/components/service/replacements/software-choice";
import { Button } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { PageHeading } from "@/components/ui/page-heading";
import { Radios } from "@/components/ui/radios";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth/guards";
import {
	AVAILABILITY_REASONS,
	softwareList,
	splitSoftware,
} from "@/services/replacements/laptops/lib/booking";
import { myCase, previousSoftware } from "@/services/replacements/laptops/lib/my-laptop";
import { sendAvailability } from "../actions";
import { LAPTOP_PAGE, withCase } from "../wording";

export const metadata: Metadata = { title: "Tell us when you are available" };

const ERRORS: Record<string, { field: string; text: string }> = {
	reason: { field: "reason", text: "Select why you cannot attend" },
	non_standard_hours: { field: "hours", text: "Enter your working days and hours" },
	other: { field: "why", text: "Tell us why you cannot attend" },
};

/** Mockups: UserAvailability, UserAvailabilityOther. */
export default async function AvailabilityPage({
	searchParams,
}: {
	searchParams: Promise<{ case?: string; error?: string }>;
}) {
	const user = await requireUser();
	const { case: token, error } = await searchParams;
	const found = await myCase(user.id, token);
	if (!found || !["pending", "unbooked", "rebook_required", "booked"].includes(found.status)) {
		redirect(`${LAPTOP_PAGE}${withCase(token)}`);
	}
	const [list, previous] = await Promise.all([softwareList(), previousSoftware(found.id)]);
	const { listed, other } = splitSoftware(found.booking?.software ?? previous, list);
	const problem = error ? ERRORS[error] : undefined;

	return (
		<ColleaguePage backHref={`${LAPTOP_PAGE}/book${withCase(token)}`}>
			<ErrorSummary
				errors={problem ? [{ fieldId: problem.field, text: problem.text }] : []}
			/>
			<PageHeading
				caption="Book your laptop replacement"
				title="Tell us when you are available"
			/>
			<p>
				If you cannot attend any of the dates we offer, we will contact you to arrange a
				time. Tell us the software you need now so we can book your appointment straight
				away.
			</p>
			<form action={sendAvailability}>
				{token ? <input type="hidden" name="case" value={token} /> : null}
				<Radios
					name="reason"
					legend="Why can you not attend?"
					legendSize="m"
					error={error === "reason" ? problem?.text : undefined}
					items={[
						{
							value: "non_standard_hours",
							label: AVAILABILITY_REASONS.non_standard_hours,
							conditional: (
								<Textarea
									id="hours"
									name="hours"
									label="What are your working days and hours?"
									hint="We may be able to accommodate them or find another way to replace your laptop."
									error={
										error === "non_standard_hours" ? problem?.text : undefined
									}
									rows={3}
								/>
							),
						},
						{
							value: "away_for_all_dates",
							label: AVAILABILITY_REASONS.away_for_all_dates,
						},
						{
							value: "other",
							label: AVAILABILITY_REASONS.other,
							conditional: (
								<Textarea
									id="why"
									name="why"
									label="Tell us why you cannot attend"
									hint="Include when you are available, so we can arrange a time."
									error={error === "other" ? problem?.text : undefined}
									rows={3}
								/>
							),
						},
					]}
				/>
				<SoftwareChoice
					list={list}
					selected={listed}
					other={other}
					legend="What software do you need?"
					isPageHeading={false}
					hint="This software will be made available for you to install when you receive your laptop. Select all that apply."
				/>
				<Button type="submit">Send</Button>
			</form>
		</ColleaguePage>
	);
}
