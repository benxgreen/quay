import type { ReactNode } from "react";
import { TeamPage } from "@/components/layouts/team-page";
import type { Breadcrumb } from "@/components/ui/breadcrumbs";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ACCESS, canAccess } from "@/lib/portal/access";
import type { NavigationLink } from "@/lib/portal/navigation";
import {
	LAPTOPS_BREADCRUMBS,
	LAPTOPS_NAVIGATION,
	LAPTOPS_SECTIONS,
	LAPTOPS_SERVICE_NAME,
	type LaptopsSection,
} from "@/services/replacements/laptops/navigation";

type LaptopsPageProps = {
	/** Which section of the service navigation is current. */
	section: LaptopsSection;
	/**
	 * Extra crumbs between the service and this page. A section's own list
	 * page needs none; a case page passes the Cases crumb.
	 */
	parents?: Breadcrumb[];
	sidebar?: ReactNode;
	sidebarPosition?: "start" | "end";
	sidebarHeader?: ReactNode;
	narrow?: boolean;
	children: ReactNode;
};

/**
 * A TeamPage for the laptop replacement service, with its breadcrumbs and
 * service navigation filled in. Settings is only in the navigation for
 * someone who can open it (the laptops admin role).
 *
 * @example
 * <LaptopsPage section="cases" parents={[LAPTOPS_SECTIONS.cases]} sidebar={<Sidebar …>}>
 */
export async function LaptopsPage(props: LaptopsPageProps) {
	const user = await getCurrentUser();
	const links = canAccess(user?.roles ?? [], ACCESS.laptopsSettings)
		? LAPTOPS_NAVIGATION
		: LAPTOPS_NAVIGATION.filter((link) => link.href !== LAPTOPS_SECTIONS.settings.href);
	return <LaptopsPageFrame {...props} links={links} />;
}

/** LaptopsPage without reading who is signed in, for Storybook: pass the navigation links. */
export function LaptopsPageFrame({
	links = LAPTOPS_NAVIGATION,
	section,
	parents = [],
	sidebar,
	sidebarPosition,
	sidebarHeader,
	narrow,
	children,
}: LaptopsPageProps & { links?: NavigationLink[] }) {
	return (
		<TeamPage
			breadcrumbs={[...LAPTOPS_BREADCRUMBS, ...parents]}
			serviceNavigation={{
				label: LAPTOPS_SERVICE_NAME,
				links,
				currentHref: LAPTOPS_SECTIONS[section].href,
			}}
			sidebar={sidebar}
			sidebarPosition={sidebarPosition}
			sidebarHeader={sidebarHeader}
			narrow={narrow}
		>
			{children}
		</TeamPage>
	);
}
