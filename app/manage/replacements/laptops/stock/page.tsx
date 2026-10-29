import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Stock – Laptop replacements" };

export default function StockPage() {
	return (
		<LaptopsPage section="stock">
			<PageHeading caption="Laptop replacements" title="Stock" />
			<InsetText>
				<p>Placeholder. The stock list is built in stage 8.</p>
			</InsetText>
		</LaptopsPage>
	);
}
