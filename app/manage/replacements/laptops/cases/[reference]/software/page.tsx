import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { SoftwareChoice } from "@/components/service/replacements/software-choice";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { softwareList, splitSoftware } from "@/services/replacements/laptops/lib/booking";
import { teamChangeSoftware } from "../../booking-actions";
import { loadForBooking } from "../book/load";

export const metadata: Metadata = { title: "Change software" };

/** The team changes software, an override after the lock. */
export default async function TeamSoftwarePage({
	params,
}: {
	params: Promise<{ reference: string }>;
}) {
	const { detail, href, crumbs } = await loadForBooking((await params).reference);
	if (!detail.booking) redirect(href);
	const list = await softwareList();
	const { listed, other } = splitSoftware(detail.booking.software, list);
	return (
		<LaptopsPage section="cases" parents={crumbs} narrow>
			<form action={teamChangeSoftware.bind(null, detail.reference)}>
				<SoftwareChoice
					list={list}
					selected={listed}
					other={other}
					legend={`What software does ${detail.person.firstName} need?`}
				/>
				<ButtonGroup>
					<Button type="submit">Save software</Button>
					<Link href={href}>Cancel</Link>
				</ButtonGroup>
			</form>
		</LaptopsPage>
	);
}
