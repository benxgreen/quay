import "./header.css";

import NextLink from "next/link";
import type { ReactNode } from "react";
import BCPCouncilLogo from "@/components/icons/organisations/bcp-logo";
import { Container, type ContainerWidth } from "@/components/ui/container";
import { classNames } from "@/lib/utils/class-names";

type HeaderProps = {
	/** Where the logo links to. */
	homeHref: string;
	/** The logo link's accessible name, for example "BCP Council Device portal". */
	homeLabel?: string;
	width?: ContainerWidth;
	/** Draws the rule under the header. Leave off when a coloured band follows it. */
	bordered?: boolean;
	/** The right-hand side, such as the signed-in person or a Menu button. */
	children?: ReactNode;
};

/**
 * The white header on every page: the BCP Council logo on the left, linking
 * home, and whatever the page needs on the right. It knows nothing about
 * navigation or sign-in, like Harbour's Header. HeaderMenu adds a Menu.
 */
export function Header({
	homeHref,
	homeLabel = "BCP Council",
	width = "large",
	bordered,
	children,
}: HeaderProps) {
	return (
		<header className={classNames("bcp-header", bordered && "bcp-header--bordered")}>
			<Container width={width}>
				<div className="bcp-header-inner">
					<NextLink href={homeHref} className="bcp-header-home" aria-label={homeLabel}>
						<BCPCouncilLogo />
					</NextLink>
					{children ? <div className="bcp-header-end">{children}</div> : null}
				</div>
			</Container>
		</header>
	);
}
