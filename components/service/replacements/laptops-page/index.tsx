import type { ReactNode } from "react";
import { TeamPage } from "@/components/layouts/team-page";
import type { Breadcrumb } from "@/components/ui/breadcrumbs";
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
 * service navigation filled in.
 *
 * @example
 * <LaptopsPage section="cases" parents={[LAPTOPS_SECTIONS.cases]} sidebar={<Sidebar …>}>
 */
export function LaptopsPage({
	section,
	parents = [],
	sidebar,
	sidebarPosition,
	sidebarHeader,
	narrow,
	children,
}: LaptopsPageProps) {
	return (
		<TeamPage
			breadcrumbs={[...LAPTOPS_BREADCRUMBS, ...parents]}
			serviceNavigation={{
				label: LAPTOPS_SERVICE_NAME,
				links: LAPTOPS_NAVIGATION,
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
