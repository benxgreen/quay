import "./link.css";

import NextLink from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/utils/class-names";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target"> & {
	href: string;
	children: ReactNode;
	/** Opens in a new tab and says so to screen reader users. Use sparingly. */
	newTab?: boolean;
	/** For links on dark backgrounds, such as the breadcrumb band. */
	inverse?: boolean;
	/** Removes the underline until hover, for dense navigation. */
	noUnderline?: boolean;
};

/**
 * A text link. Internal paths use Next.js client navigation; anything else is
 * a plain anchor. Unlike Harbour's Link, external links stay in the same tab
 * unless `newTab` is set (GOV.UK guidance).
 *
 * @example
 * <Link href="/manage/replacements/laptops/cases">Cases</Link>
 */
export function Link({
	href,
	children,
	newTab,
	inverse,
	noUnderline,
	className,
	...props
}: LinkProps) {
	const linkClassName = classNames(
		"bcp-link",
		inverse && "bcp-link--inverse",
		noUnderline && "bcp-link--no-underline",
		className,
	);
	const newTabProps = newTab ? { target: "_blank", rel: "noopener noreferrer" } : {};
	const content = (
		<>
			{children}
			{newTab ? (
				<>
					{" "}
					<span className="sr-only">(opens in new tab)</span>
				</>
			) : null}
		</>
	);

	if (href.startsWith("/")) {
		return (
			<NextLink href={href} className={linkClassName} {...newTabProps} {...props}>
				{content}
			</NextLink>
		);
	}

	return (
		<a href={href} className={linkClassName} {...newTabProps} {...props}>
			{content}
		</a>
	);
}

/**
 * Back link for the top of question pages, used instead of breadcrumbs.
 *
 * @example
 * <BackLink href="/my/replacements/laptop" />
 */
export function BackLink({ href, children = "Back" }: { href: string; children?: ReactNode }) {
	return (
		<Link href={href} className="bcp-back-link">
			{children}
		</Link>
	);
}
