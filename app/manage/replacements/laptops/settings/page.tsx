import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Settings – Laptop replacements" };

export default function SettingsPage() {
	return (
		<LaptopsPage section="settings">
			<PageHeading caption="Laptop replacements" title="Settings" />
			<InsetText>
				<p>Placeholder. The service settings is built in stage 12.</p>
			</InsetText>
		</LaptopsPage>
	);
}
