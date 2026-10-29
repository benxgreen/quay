import "./team-page.css";

import type { ReactNode } from "react";
import { type Breadcrumb, Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { ServiceNavigation, type ServiceNavigationLink } from "@/components/ui/service-navigation";
import { SidebarLayout } from "@/components/ui/sidebar-layout";

type TeamPageProps = {
	/** Ancestors of this page, starting with Manage. */
	breadcrumbs: Breadcrumb[];
	/** The service's sections. Leave out on portal-wide pages such as Users. */
	serviceNavigation?: {
		label: string;
		links: ServiceNavigationLink[];
		currentHref?: string;
	};
	/** Sidebar content, such as case actions. Pass it only when there is something to act on. */
	sidebar?: ReactNode;
	/** A confirmation or form page: content up to 720px. */
	narrow?: boolean;
	children: ReactNode;
};

/**
 * Everything on a team page below the header (mockups: "Team list page",
 * "Team detail page", "Confirmation page"): the breadcrumb band, the service
 * navigation and the main content in the full-width container.
 */
export function TeamPage({
	breadcrumbs,
	serviceNavigation,
	sidebar,
	narrow,
	children,
}: TeamPageProps) {
	return (
		<>
			<Breadcrumbs items={breadcrumbs} width="full" />
			{serviceNavigation ? <ServiceNavigation {...serviceNavigation} width="full" /> : null}
			<Container as="main" width="full" className="bcp-team-page">
				<div className={narrow ? "bcp-team-page-narrow" : undefined}>
					<SidebarLayout sidebar={sidebar}>{children}</SidebarLayout>
				</div>
			</Container>
		</>
	);
}
