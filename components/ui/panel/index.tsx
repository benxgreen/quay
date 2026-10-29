import "./panel.css";

import type { ReactNode } from "react";

/**
 * Green confirmation panel. The portal mostly returns people to the page
 * they started from with a success banner instead; use this only where a
 * journey genuinely ends on its own page.
 */
export function Panel({ title, children }: { title: ReactNode; children?: ReactNode }) {
	return (
		<div className="bcp-panel">
			<h1 className="bcp-panel-title">{title}</h1>
			{children ? <div className="bcp-panel-body">{children}</div> : null}
		</div>
	);
}
