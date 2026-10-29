import "./warning-text.css";

import type { ReactNode } from "react";

/**
 * Goes before an action that cannot be undone, such as "This updates Halo
 * and cannot be undone."
 */
export function WarningText({ children }: { children: ReactNode }) {
	return (
		<div className="bcp-warning-text">
			<span className="bcp-warning-text-icon" aria-hidden="true">
				!
			</span>
			<strong className="bcp-warning-text-content">
				<span className="sr-only">Warning:</span> {children}
			</strong>
		</div>
	);
}
