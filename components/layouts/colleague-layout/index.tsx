import "./colleague-layout.css";

import type { ReactNode } from "react";
import {
	type Impersonation,
	ImpersonationBanner,
} from "@/components/patterns/impersonation-banner";
import { Footer } from "@/components/ui/footer";
import { Header } from "@/components/ui/header";
import { PhaseBanner } from "@/components/ui/phase-banner";
import { SkipLink } from "@/components/ui/skip-link";

type ColleagueLayoutProps = {
	/** The signed-in person; leave out on pages anyone can see, such as sign-in. */
	user?: { displayName: string; email: string } | null;
	/** Shown above the header while an Administrator is impersonating someone. */
	impersonation?: Impersonation | null;
	children: ReactNode;
};

/**
 * The frame for a colleague's own pages under /my (mockups: "Header:
 * colleague"): the header with the signed-in person on the right, no
 * breadcrumbs or service navigation, in the large (1100px) container. There is no sign-out link, because the portal uses
 * single sign-on.
 */
export function ColleagueLayout({ user, impersonation, children }: ColleagueLayoutProps) {
	return (
		<>
			<SkipLink />
			{impersonation ? <ImpersonationBanner impersonation={impersonation} /> : null}
			<Header homeHref="/my" width="large" bordered />
			<PhaseBanner>
				{user ? (
					<p className="bcp-colleague-layout-user" title={user.email}>
						Hello, {user.displayName}{" "}
					</p>
				) : null}
			</PhaseBanner>
			{children}
			<Footer width="large" />
		</>
	);
}
