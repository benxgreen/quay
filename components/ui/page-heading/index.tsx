import "./page-heading.css";

import type { ReactNode } from "react";
import { classNames } from "@/lib/utils/class-names";

type PageHeadingProps = {
	/** Grey context above the title, such as "Case LR-000123" or "Laptop replacements". */
	caption?: ReactNode;
	title: ReactNode;
	/** Status and type tags, in a row under the title. */
	tags?: ReactNode;
	/** A lead paragraph under the title. */
	lede?: ReactNode;
	/** The page's main action. It sits under the title, never beside it. */
	children?: ReactNode;
};

/**
 * The caption, h1 and main action at the top of a page. Spacing follows the
 * mockups: 30px after a heading on its own, 40px after tags, 50px after a
 * lede or an action.
 *
 * @example
 * <PageHeading caption="Laptop replacements" title="Cases">
 *   <Button href="/manage/replacements/laptops/cases/add">Add a case</Button>
 * </PageHeading>
 */
export function PageHeading({ caption, title, tags, lede, children }: PageHeadingProps) {
	return (
		<div
			className={classNames(
				"bcp-page-heading",
				tags ? "bcp-page-heading--tags" : undefined,
				lede || children ? "bcp-page-heading--spaced" : undefined,
			)}
		>
			{caption ? <span className="bcp-caption">{caption}</span> : null}
			<h1 className="bcp-page-heading-title">{title}</h1>
			{tags ? <div className="bcp-page-heading-tags">{tags}</div> : null}
			{lede ? <p className="bcp-page-heading-lede">{lede}</p> : null}
			{children ? <div className="bcp-page-heading-actions">{children}</div> : null}
		</div>
	);
}

/** The grey caption on its own, for use above a legend or label that is the page heading. */
export function Caption({ children }: { children: ReactNode }) {
	return <span className="bcp-caption">{children}</span>;
}
