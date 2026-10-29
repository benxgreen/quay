import "./button.css";

import NextLink from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/utils/class-names";

export type ButtonVariant = "primary" | "secondary" | "warning";

type CommonProps = {
	variant?: ButtonVariant;
	/** Smaller button for filter panels and dense toolbars. */
	small?: boolean;
	className?: string;
	children: ReactNode;
};

type ButtonAsButton = CommonProps &
	Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };

type ButtonAsLink = CommonProps & { href: string };

/**
 * One green primary button per page for the main action; secondary for
 * other actions; warning (red) for destructive actions, always behind a
 * confirmation page. Pass `href` to render a link that looks like a button
 * (for actions that navigate, such as "Add a case").
 *
 * A server component: Harbour's `removeParam` behaviour is not carried over,
 * so pages that need it can use a client component of their own.
 *
 * @example
 * <Button type="submit">Save session</Button>
 * <Button variant="secondary" href="/manage/replacements/laptops/import">Refresh from Halo</Button>
 * <Button variant="warning" type="submit">Withdraw case</Button>
 */
export function Button(props: ButtonAsButton | ButtonAsLink) {
	const { variant = "primary", small, className, children } = props;
	const buttonClassName = classNames(
		"bcp-button",
		variant !== "primary" && `bcp-button--${variant}`,
		small && "bcp-button--small",
		className,
	);

	if (props.href !== undefined) {
		return (
			<NextLink href={props.href} className={buttonClassName} draggable={false}>
				{children}
			</NextLink>
		);
	}

	const { variant: _v, small: _s, className: _c, children: _ch, type, ...rest } = props;
	return (
		<button type={type ?? "button"} className={buttonClassName} {...rest}>
			{children}
		</button>
	);
}

/**
 * Lays out a main button, then secondary buttons or a Cancel link.
 *
 * @example
 * <ButtonGroup>
 *   <Button type="submit">Add case</Button>
 *   <Link href="/manage/replacements/laptops/cases">Cancel</Link>
 * </ButtonGroup>
 */
export function ButtonGroup({ children }: { children: ReactNode }) {
	return <div className="bcp-button-group">{children}</div>;
}

/**
 * Icon-only button that opens more detail about a table row. The label must
 * name the row, for example "User details for Leah Turner".
 */
export function InfoButton({
	label,
	...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & { label: string }) {
	return (
		<button type="button" className="bcp-button-info" aria-label={label} {...props}>
			<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
				<path d="M12 10.5v6.5" stroke="currentColor" strokeWidth="2" />
				<circle cx="12" cy="7.25" r="1.25" fill="currentColor" />
			</svg>
		</button>
	);
}
