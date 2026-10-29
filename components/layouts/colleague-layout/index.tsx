import "./colleague-layout.css";

import type { ReactNode } from "react";
import { Footer } from "@/components/ui/footer";
import { Header } from "@/components/ui/header";
import { SkipLink } from "@/components/ui/skip-link";

type ColleagueLayoutProps = {
	user: { firstName: string; email: string };
	children: ReactNode;
};

/**
 * The frame for a colleague's own pages under /my (mockups: "Header:
 * colleague"): the header with the signed-in person on the right, no
 * breadcrumbs or service navigation, in the large (1100px) container. There is no sign-out link, because the portal uses
 * single sign-on.
 */
export function ColleagueLayout({ user, children }: ColleagueLayoutProps) {
	return (
		<>
			<SkipLink />
			<Header homeHref="/my" homeLabel="BCP Council Device portal" width="large" bordered>
				<p className="bcp-colleague-layout-user">
					Hi {user.firstName}{" "}
					<span className="bcp-colleague-layout-email">({user.email})</span>
				</p>
			</Header>
			{children}
			<Footer width="large" />
		</>
	);
}
