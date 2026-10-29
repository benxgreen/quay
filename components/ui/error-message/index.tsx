import "./error-message.css";

import type { ReactNode } from "react";

/**
 * The red message above a field. The `id` is what the field's
 * aria-describedby points at; the hidden "Error:" prefix tells screen reader
 * users what kind of message it is. Renders nothing without children.
 */
export function ErrorMessage({ id, children }: { id?: string; children?: ReactNode }) {
	if (!children) {
		return null;
	}

	return (
		<p id={id} className="bcp-error-message">
			<span className="sr-only">Error:</span> {children}
		</p>
	);
}
