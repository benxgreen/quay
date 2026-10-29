import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Bookings – Laptop replacements" };

export default function BookingsPage() {
	return (
		<LaptopsPage section="bookings">
			<PageHeading caption="Laptop replacements" title="Bookings" />
			<InsetText>
				<p>Placeholder. The bookings dashboard is built in stage 11.</p>
			</InsetText>
		</LaptopsPage>
	);
}
