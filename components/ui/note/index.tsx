import "./note.css";

import type { ReactNode } from "react";

/**
 * A summary or status line at the top of a page or list (light purple), for
 * example "41 cases are waiting for an invitation." The `check` variant
 * (yellow) is something the team should look at before acting.
 *
 * @example
 * <Note><p><strong>41 cases</strong> are waiting for an invitation.</p></Note>
 * <Note variant="check"><p>Leah has another laptop that was seen today.</p></Note>
 */
export function Note({
	variant = "default",
	children,
}: {
	variant?: "default" | "check";
	children: ReactNode;
}) {
	return <div className={`bcp-note bcp-note--${variant}`}>{children}</div>;
}
