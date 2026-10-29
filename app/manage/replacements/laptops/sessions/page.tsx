import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Sessions – Laptop replacements" };

export default function SessionsPage() {
	return (
		<LaptopsPage section="sessions">
			<PageHeading caption="Laptop replacements" title="Sessions" />
			<InsetText>
				<p>Placeholder. The sessions list is built in stage 5.</p>
			</InsetText>
		</LaptopsPage>
	);
}
