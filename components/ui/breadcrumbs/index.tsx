import "./breadcrumbs.css";

import NextLink from "next/link";
import { Container, type ContainerWidth } from "@/components/ui/container";

export type Breadcrumb = { text: string; href: string };

/**
 * The purple band directly under the header. Every crumb is a link to an
 * ancestor of the current page (the page itself is not repeated), separated
 * by a chevron that screen readers skip.
 *
 * @example
 * <Breadcrumbs items={[{ text: "Manage", href: "/manage" }, { text: "Laptop replacements", href: "/manage/replacements/laptops" }]} />
 */
export function Breadcrumbs({
	items,
	width = "large",
}: {
	items: Breadcrumb[];
	width?: ContainerWidth;
}) {
	if (items.length === 0) {
		return null;
	}

	return (
		<div className="bcp-breadcrumbs">
			<Container width={width}>
				<nav aria-label="Breadcrumb">
					<ol className="bcp-breadcrumbs-list">
						{items.map((item, index) => (
							<li key={item.href} className="bcp-breadcrumbs-item">
								{index > 0 ? <span aria-hidden="true">›</span> : null}
								<NextLink className="bcp-breadcrumbs-link" href={item.href}>
									{item.text}
								</NextLink>
							</li>
						))}
					</ol>
				</nav>
			</Container>
		</div>
	);
}
