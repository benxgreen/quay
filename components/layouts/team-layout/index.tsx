import type { ReactNode } from "react";
import {
	type Impersonation,
	ImpersonationBanner,
} from "@/components/patterns/impersonation-banner";
import { Footer } from "@/components/ui/footer";
import { HeaderMenu, type HeaderMenuGroup } from "@/components/ui/header-menu";
import { SkipLink } from "@/components/ui/skip-link";

/**
 * The frame for every team page under /manage (mockups: "Header: team"):
 * skip link, the header with the Menu, the page (a TeamPage) and the footer,
 * all in the full-width (1260px) container.
 */
export function TeamLayout({
	menu,
	impersonation,
	children,
}: {
	menu: HeaderMenuGroup[];
	/** Shown above the header while an Administrator is impersonating someone. */
	impersonation?: Impersonation | null;
	children: ReactNode;
}) {
	return (
		<>
			<SkipLink />
			{impersonation ? (
				<ImpersonationBanner impersonation={impersonation} width="full" />
			) : null}
			<HeaderMenu homeHref="/manage" width="full" groups={menu} />
			{children}
			<Footer width="full" />
		</>
	);
}
