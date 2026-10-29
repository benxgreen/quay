import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Import – Laptop replacements" };

export default function ImportPage() {
	return (
		<LaptopsPage section="import">
			<PageHeading caption="Laptop replacements" title="Import" />
			<InsetText>
				<p>Placeholder. The import screen and invitation queue is built in stage 6.</p>
			</InsetText>
		</LaptopsPage>
	);
}
