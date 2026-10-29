import "./sidebar.css";

import type { ReactNode } from "react";

/**
 * The grey panel used for a page's sidebar, such as case actions or list
 * filters. Rendered as an `aside` landmark named by `label`.
 *
 * Unlike Harbour's Sidebar there is no "show on phones" toggle: the
 * mockups show the panel open at every width.
 *
 * @example
 * <Sidebar label="Case actions"><ActionList … /></Sidebar>
 */
export function Sidebar({ label, children }: { label: string; children: ReactNode }) {
	return (
		<aside className="bcp-sidebar" aria-label={label}>
			{children}
		</aside>
	);
}
