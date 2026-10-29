import "./secondary-navigation.css";

import NextLink from "next/link";

export type SecondaryNavigationItem = {
	text: string;
	href: string;
	/** Shown after the text where it helps, for example "Needs attention (4)". */
	count?: number;
	current?: boolean;
};

/**
 * Moves between related pages within a section, such as the Import pages.
 * Based on the DWP horizontal navigation (from the X-GOVUK secondary
 * navigation). The current page is marked with aria-current.
 *
 * @example
 * <SecondaryNavigation
 *   label="Import"
 *   items={[
 *     { text: "Eligible devices", href: "/manage/replacements/laptops/import", count: 38, current: true },
 *     { text: "Needs attention", href: "/manage/replacements/laptops/import/attention", count: 4 },
 *   ]}
 * />
 */
export function SecondaryNavigation({
	label,
	items,
}: {
	label: string;
	items: SecondaryNavigationItem[];
}) {
	return (
		<nav className="bcp-secondary-navigation" aria-label={label}>
			<ul className="bcp-secondary-navigation-list">
				{items.map((item) => (
					<li key={item.href} className="bcp-secondary-navigation-item">
						<NextLink
							className="bcp-secondary-navigation-link"
							href={item.href}
							aria-current={item.current ? "page" : undefined}
						>
							{item.text}
							{item.count !== undefined ? ` (${item.count})` : null}
						</NextLink>
					</li>
				))}
			</ul>
		</nav>
	);
}
