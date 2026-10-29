import "./inset-text.css";

import type { ReactNode } from "react";

/**
 * Something the reader should not miss but that is not a warning, such as
 * "Changes to this list only apply to cases that haven't progressed past step 1".
 */
export function InsetText({ children }: { children: ReactNode }) {
	return <div className="bcp-inset-text">{children}</div>;
}
