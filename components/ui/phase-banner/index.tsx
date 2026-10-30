import type { ReactNode } from "react";
import "@/components/ui/tag/tag.css";
import "./phase-banner.css";
import { Container, type ContainerWidth } from "@/components/ui/container";
import { Tag } from "../tag";

export type TagColour = "grey" | "blue" | "green" | "red" | "yellow";

type PhaseBannerProps = {
	tag?: string;
	colour?: TagColour;
	children: ReactNode;
	width?: ContainerWidth;
};

export function PhaseBanner({ tag, colour, children, width = "large" }: PhaseBannerProps) {
	return (
		<div className="bcp-phase-banner">
			<Container as="div" width={width} space="xl" className="bcp-phase-banner-content">
				{tag && <Tag colour={colour}>{tag}</Tag>}
				<div>{children}</div>
			</Container>
		</div>
	);
}
