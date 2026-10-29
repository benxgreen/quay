import "./group-heading.css";

import type { ReactNode } from "react";

type GroupHeadingProps = {
	title: ReactNode;
	headingLevel?: 2 | 3;
	/** Before the title, such as the type tag. */
	before?: ReactNode;
	/** A line after the title, such as the location and places booked. */
	meta?: ReactNode;
	/** After the meta, such as a "Full" tag. */
	after?: ReactNode;
	/** On the right, such as a "View session" link. */
	action?: ReactNode;
};

/**
 * Splits a long table into groups, such as the sessions on a bookings
 * dashboard: a heading row with a purple rule under it, then the group's
 * table.
 *
 * @example
 * <GroupHeading before={<TypeTag type="session" />} title="9:30am" meta="Room 310 · 5 of 5 booked" after={<Tag colour="red">Full</Tag>} action={<Link href="…">View session</Link>} />
 */
export function GroupHeading({
	title,
	headingLevel = 2,
	before,
	meta,
	after,
	action,
}: GroupHeadingProps) {
	const Heading = `h${headingLevel}` as const;

	return (
		<div className="bcp-group-heading">
			{before}
			<Heading className="bcp-group-heading-title">{title}</Heading>
			{meta ? <span className="bcp-group-heading-meta">{meta}</span> : null}
			{after}
			{action ? <span className="bcp-group-heading-action">{action}</span> : null}
		</div>
	);
}
