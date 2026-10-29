import "./details.css";

import type { ReactNode } from "react";

/**
 * Hides secondary information until asked for, such as the list of hidden
 * laptops on the import screen or an FAQ answer.
 *
 * @example
 * <Details summary="See 22 hidden laptops">…</Details>
 */
export function Details({
	summary,
	open,
	children,
}: {
	summary: ReactNode;
	open?: boolean;
	children: ReactNode;
}) {
	return (
		<details className="bcp-details" open={open}>
			<summary className="bcp-details-summary">
				<span className="bcp-details-summary-text">{summary}</span>
			</summary>
			<div className="bcp-details-text">{children}</div>
		</details>
	);
}
