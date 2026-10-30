import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { SoftwareChoice } from "@/components/service/replacements/software-choice";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { softwareList, splitSoftware } from "@/services/replacements/laptops/lib/booking";
import { previousSoftware } from "@/services/replacements/laptops/lib/my-laptop";
import { teamChooseSoftware } from "../../../booking-actions";
import { loadForBooking } from "../load";

export const metadata: Metadata = { title: "Book on behalf" };

type Props = {
	params: Promise<{ reference: string }>;
	searchParams: Promise<{ session?: string }>;
};

/** Mockups: AdminBookSoftware. Starts from their last request, if any. */
export default async function BookSoftwarePage({ params, searchParams }: Props) {
	const { detail, href, crumbs, caption } = await loadForBooking((await params).reference);
	const { session } = await searchParams;
	const [list, previous] = await Promise.all([softwareList(), previousSoftware(detail.id)]);
	const { listed, other } = splitSoftware(previous, list);
	const first = detail.person.firstName;

	return (
		<LaptopsPage section="cases" parents={crumbs} narrow>
			<form action={teamChooseSoftware.bind(null, detail.reference)}>
				<input type="hidden" name="session" value={session ?? ""} />
				<SoftwareChoice
					list={list}
					selected={listed}
					other={other}
					legend={`What software does ${first} need?`}
					caption={caption}
					hint={`Select all that apply. If you don't know yet, leave this blank. ${first} can choose from the link in the confirmation email until the software lock.`}
				/>
				<ButtonGroup>
					<Button type="submit">Continue</Button>
					<Link href={href}>Cancel</Link>
				</ButtonGroup>
			</form>
		</LaptopsPage>
	);
}
