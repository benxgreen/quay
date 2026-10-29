import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";

export const metadata: Metadata = { title: "New starters" };

export default function NewStartersPage() {
	return (
		<TeamPage breadcrumbs={[MANAGE_BREADCRUMB]}>
			<PageHeading title="New starters" />
			<InsetText>
				<p>New starters has not been built yet.</p>
			</InsetText>
		</TeamPage>
	);
}
