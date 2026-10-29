import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";

export const metadata: Metadata = { title: "Smartphone replacements" };

export default function SmartphoneReplacementsPage() {
	return (
		<TeamPage breadcrumbs={[MANAGE_BREADCRUMB]}>
			<PageHeading title="Smartphone replacements" />
			<InsetText>
				<p>Smartphone replacements has not been built yet.</p>
			</InsetText>
		</TeamPage>
	);
}
