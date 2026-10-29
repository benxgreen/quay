import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
	return (
		<TeamPage breadcrumbs={[MANAGE_BREADCRUMB]}>
			<PageHeading title="Users" />
			<InsetText>
				<p>Placeholder. The Users pages are built in stage 4.</p>
			</InsetText>
		</TeamPage>
	);
}
