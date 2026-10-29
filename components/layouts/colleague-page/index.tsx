import "./colleague-page.css";

import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { BackLink } from "@/components/ui/link";
import { classNames } from "@/lib/utils/class-names";

type ColleaguePageProps = {
	/**
	 * Makes it a question page (mockups: "Question page"): a Back link
	 * instead of breadcrumbs and content up to 680px. Otherwise one column up
	 * to 760px.
	 */
	backHref?: string;
	children: ReactNode;
};

/** The main content of a colleague page. Banners go first, above the caption and heading. */
export function ColleaguePage({ backHref, children }: ColleaguePageProps) {
	return (
		<Container
			as="main"
			width="large"
			className={classNames("bcp-colleague-page", backHref && "bcp-colleague-page--question")}
		>
			{backHref ? <BackLink href={backHref} /> : null}
			<div className={backHref ? "bcp-colleague-page-question" : "bcp-colleague-page-column"}>
				{children}
			</div>
		</Container>
	);
}
