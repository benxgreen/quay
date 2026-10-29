import "./tag.css";

import type { ReactNode } from "react";
import { classNames } from "@/lib/utils/class-names";

export type TagColour =
	| "grey"
	| "green"
	| "red"
	| "yellow"
	| "orange"
	| "turquoise"
	| "blue"
	| "light-blue"
	| "purple"
	| "pink";

/**
 * A short status label. Always colour plus a word, never colour alone. Put
 * tags in table cells and headings; in running text, write the status as
 * plain words instead.
 *
 * @example
 * <Tag colour="green">Booked</Tag>
 */
export function Tag({
	colour = "grey",
	className,
	children,
}: {
	colour?: TagColour;
	className?: string;
	children: ReactNode;
}) {
	return (
		<strong className={classNames("bcp-tag", `bcp-tag--${colour}`, className)}>
			{children}
		</strong>
	);
}

/** Lays out several tags with a gap, for example status and type in a heading. */
export function TagGroup({ children }: { children: ReactNode }) {
	return <span className="bcp-tag-group">{children}</span>;
}
