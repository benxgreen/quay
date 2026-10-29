import "./date-navigation.css";

import NextLink from "next/link";
import type { ReactNode } from "react";

type DateLink = { href: string; text: string };

type DateNavigationProps = {
	/** The period being shown, such as "Wednesday 11 November 2026". */
	heading: ReactNode;
	headingLevel?: 2 | 3;
	/** Names the navigation, such as "Change day". */
	label: string;
	/** "Previous day", "Previous week" and so on. */
	previous: DateLink;
	/** Usually "Today". */
	current?: DateLink;
	next: DateLink;
};

/**
 * The heading for a day, week or month on the left, with Previous, Today
 * and Next together on the right. The unit changes with the view.
 *
 * @example
 * <DateNavigation heading="Wednesday 11 November 2026" label="Change day"
 *   previous={{ href: "?day=2026-11-10", text: "Previous day" }}
 *   current={{ href: "?", text: "Today" }}
 *   next={{ href: "?day=2026-11-12", text: "Next day" }} />
 */
export function DateNavigation({
	heading,
	headingLevel = 2,
	label,
	previous,
	current,
	next,
}: DateNavigationProps) {
	const Heading = `h${headingLevel}` as const;

	return (
		<div className="bcp-date-navigation">
			<Heading className="bcp-date-navigation-heading">{heading}</Heading>
			<nav className="bcp-date-navigation-links" aria-label={label}>
				<NextLink href={previous.href}>
					<span aria-hidden="true">‹ </span>
					{previous.text}
				</NextLink>
				{current ? <NextLink href={current.href}>{current.text}</NextLink> : null}
				<NextLink href={next.href}>
					{next.text}
					<span aria-hidden="true"> ›</span>
				</NextLink>
			</nav>
		</div>
	);
}
