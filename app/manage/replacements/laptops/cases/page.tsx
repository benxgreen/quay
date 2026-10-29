import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Cases – Laptop replacements" };

export default function CasesPage() {
	return (
		<LaptopsPage section="cases">
			<PageHeading caption="Laptop replacements" title="Cases" />
			<InsetText>
				<p>Placeholder. The cases list is built in stage 7.</p>
			</InsetText>
		</LaptopsPage>
	);
}
