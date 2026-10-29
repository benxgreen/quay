import type { CSSProperties, ReactNode } from "react";
import "./container.css";

export const SPACE_TOKENS = [
	"xxs",
	"xs",
	"sm",
	"md",
	"lg",
	"xl",
	"2xl",
	"3xl",
	"4xl",
	"5xl",
	"6xl",
	"7xl",
	"8xl",
	"9xl",
	"10xl",
] as const;
export type SpaceToken = (typeof SPACE_TOKENS)[number];

const CONTAINER_WIDTH_CLASSES = {
	full: "bcp-container-width",
	large: "bcp-container-width bcp-container-width--large",
	medium: "bcp-container-width bcp-container-width--medium",
} as const;
export type ContainerWidth = keyof typeof CONTAINER_WIDTH_CLASSES;

const CONTENT_WIDTH_CLASSES = {
	full: "",
	half: "bcp-content-width--half",
	third: "bcp-content-width--third",
} as const;
type ContentWidth = keyof typeof CONTENT_WIDTH_CLASSES;

function verticalPaddingStyle(space: SpaceToken | number): CSSProperties {
	const value = typeof space === "number" ? `${space}em` : `var(--bcp-space-${space})`;
	return { paddingTop: value, paddingBottom: value };
}

/**
 * Harbour's Container. `width` sets the maximum width including gutters
 * (full 1260px, large 1100px, medium 820px in Quay); `contentWidth` narrows
 * what is inside (half 820px, third 540px); `space` adds vertical padding.
 * Rendered as `main` it gets the page's default vertical spacing and is the
 * `#main` target for the skip link.
 *
 * @example
 * <Container as="main" width="full">…</Container>
 */
export function Container({
	as = "div",
	children,
	width = "large",
	contentWidth = "full",
	space,
	className,
	...props
}: {
	as?: "main" | "div" | "section";
	children: ReactNode;
	width?: ContainerWidth;
	contentWidth?: ContentWidth;
	space?: SpaceToken | number;
	className?: string;
}) {
	const Component = as;
	// The page body gets its rhythm baked into CSS (so it can respond to the
	// mobile breakpoint); anything else opts in via the `space` prop.
	const useDefaultSpacing = space === undefined && as === "main";

	return (
		<Component
			className={[
				CONTAINER_WIDTH_CLASSES[width],
				useDefaultSpacing ? "bcp-container-space" : "",
				className,
			]
				.filter(Boolean)
				.join(" ")}
			id={as === "main" ? "main" : undefined}
			tabIndex={as === "main" ? -1 : undefined}
			style={space === undefined ? undefined : verticalPaddingStyle(space)}
			{...props}
		>
			{contentWidth !== "full" ? (
				<div className={CONTENT_WIDTH_CLASSES[contentWidth] || undefined}>{children}</div>
			) : (
				children
			)}
		</Component>
	);
}
