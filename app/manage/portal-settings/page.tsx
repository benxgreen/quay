import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";

export const metadata: Metadata = { title: "Portal settings" };

export default function PortalSettingsPage() {
	return (
		<TeamPage breadcrumbs={[MANAGE_BREADCRUMB]}>
			<PageHeading title="Portal settings" />
			<InsetText>
				<p>Placeholder. Portal settings (the email template) are built in stage 12.</p>
			</InsetText>
		</TeamPage>
	);
}
