import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { requireUser } from "@/lib/auth/guards";
import { menuGroups } from "@/lib/portal/navigation";

export const metadata: Metadata = { title: "Management" };

export default async function ManagePage() {
	const user = await requireUser();
	const groups = menuGroups(user.roles);

	return (
		<TeamPage breadcrumbs={[]}>
			<PageHeading title="Manage" />
			{groups.map((group) => (
				<section key={group.title} aria-labelledby={`manage-${group.title}`}>
					<h2 id={`manage-${group.title}`}>{group.title}</h2>
					<ul className="bcp-list--plain">
						{group.links.map((link) => (
							<li key={link.href}>
								<Link href={link.href}>{link.text}</Link>
							</li>
						))}
					</ul>
				</section>
			))}
		</TeamPage>
	);
}
