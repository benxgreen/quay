import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Statistics – Laptop replacements" };

export default function StatisticsPage() {
	return (
		<LaptopsPage section="statistics">
			<PageHeading caption="Laptop replacements" title="Statistics" />
			<InsetText>
				<p>Placeholder. The statistics page is built in stage 13.</p>
			</InsetText>
		</LaptopsPage>
	);
}
