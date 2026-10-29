import "@/components/ui/link/link.css";
import "./action-list.css";

import NextLink from "next/link";
import { classNames } from "@/lib/utils/class-names";

export type ActionListItem = {
	text: string;
	href: string;
	/** A short line under the link saying what it does. */
	description: string;
	/** Shows the link in red, for actions such as Withdraw case. */
	destructive?: boolean;
};

/**
 * A heading and a list of links, each with a line saying what it does. Put
 * it in a Sidebar beside the page's main content; render it only while
 * there is something to do. Each action links to its own confirmation page.
 *
 * @example
 * <Sidebar label="Case actions">
 *   <ActionList items={[{ text: "Cancel booking", href: "…", description: "Priya will be asked to rebook" }]} />
 * </Sidebar>
 */
export function ActionList({
	title = "Actions",
	items,
}: {
	title?: string;
	items: ActionListItem[];
}) {
	if (items.length === 0) {
		return null;
	}

	return (
		<>
			<h2 className="bcp-action-list-title">{title}</h2>
			<ul className="bcp-action-list">
				{items.map((item) => (
					<li key={item.href} className="bcp-action-list-item">
						<NextLink
							className={classNames(
								"bcp-link",
								item.destructive && "bcp-action-list-link--destructive",
							)}
							href={item.href}
						>
							{item.text}
						</NextLink>
						<span className="bcp-action-list-description">{item.description}</span>
					</li>
				))}
			</ul>
		</>
	);
}
