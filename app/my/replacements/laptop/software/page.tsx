import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { SoftwareChoice } from "@/components/service/replacements/software-choice";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { formatLongDate } from "@/lib/dates/format";
import {
	bookingSettings,
	softwareChangeDeadline,
	softwareList,
	softwareLocked,
	splitSoftware,
} from "@/services/replacements/laptops/lib/booking";
import { myCase } from "@/services/replacements/laptops/lib/my-laptop";
import { saveMySoftware } from "../actions";
import { LAPTOP_PAGE, withCase } from "../wording";

export const metadata: Metadata = { title: "What software do you need?" };

/** Mockups: UserChangeSoftware. Only until the software lock. */
export default async function ChangeSoftwarePage({
	searchParams,
}: {
	searchParams: Promise<{ case?: string }>;
}) {
	const user = await requireUser();
	const { case: token } = await searchParams;
	const found = await myCase(user.id, token);
	const back = `${LAPTOP_PAGE}${withCase(token)}`;
	if (!found?.booking) redirect(back);
	const [list, settings] = await Promise.all([softwareList(), bookingSettings()]);
	if (softwareLocked(found.booking.date, settings)) redirect(back);
	const { listed, other } = splitSoftware(found.booking.software, list);
	const deadline = formatLongDate(softwareChangeDeadline(found.booking.date, settings), {
		year: true,
	});

	return (
		<ColleaguePage backHref={back}>
			<form action={saveMySoftware}>
				{token ? <input type="hidden" name="case" value={token} /> : null}
				<SoftwareChoice
					list={list}
					selected={listed}
					other={other}
					legend="What software do you need?"
					caption="Change your booking"
					hint={`This software will be made available for you to install when you receive your laptop. You can change it until 11:59pm on ${deadline}. Select all that apply.`}
				/>
				<Button type="submit">Save software</Button>
			</form>
		</ColleaguePage>
	);
}
