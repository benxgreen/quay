import type { ReactNode } from "react";
import { Footer } from "@/components/ui/footer";
import { HeaderMenu, type HeaderMenuGroup } from "@/components/ui/header-menu";
import { SkipLink } from "@/components/ui/skip-link";

/**
 * The frame for every team page under /manage (mockups: "Header: team"):
 * skip link, the header with the Menu, the page (a TeamPage) and the footer,
 * all in the full-width (1260px) container.
 */
export function TeamLayout({ menu, children }: { menu: HeaderMenuGroup[]; children: ReactNode }) {
	return (
		<>
			<SkipLink />
			<HeaderMenu
				homeHref="/manage"
				homeLabel="BCP Council Device portal"
				width="full"
				groups={menu}
			/>
			{children}
			<Footer width="full" />
		</>
	);
}
