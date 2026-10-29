import "./service-navigation.css";

import NextLink from "next/link";
import { Container, type ContainerWidth } from "@/components/ui/container";

export type ServiceNavigationLink = { text: string; href: string };

type ServiceNavigationProps = {
	/** Names the navigation landmark, usually the service name. */
	label: string;
	links: ServiceNavigationLink[];
	/** The href of the current section, marked with aria-current. */
	currentHref?: string;
	width?: ContainerWidth;
};

/**
 * The service's sections, on team pages only: a light grey bar with a
 * purple underline on the current section. Links wrap on narrow screens
 * rather than collapsing behind a second menu button, because the header
 * already has one.
 *
 * Unlike Harbour's version this is a server component: the page says which
 * section is current instead of the component reading the URL.
 *
 * @example
 * <ServiceNavigation label="Laptop replacements" links={laptopLinks} currentHref="/manage/replacements/laptops/cases" />
 */
export function ServiceNavigation({
	label,
	links,
	currentHref,
	width = "large",
}: ServiceNavigationProps) {
	return (
		<nav className="bcp-service-navigation" aria-label={label}>
			<Container width={width}>
				<ul className="bcp-service-navigation-list">
					{links.map((link) => (
						<li key={link.href} className="bcp-service-navigation-item">
							<NextLink
								className="bcp-service-navigation-link"
								href={link.href}
								aria-current={link.href === currentHref ? "page" : undefined}
							>
								{link.text}
							</NextLink>
						</li>
					))}
				</ul>
			</Container>
		</nav>
	);
}
