import "./inset-text.css";

import type { ReactNode } from "react";
import { classNames } from "@/lib/utils/class-names";

/**
 * Something the reader should not miss but that is not a warning, such as
 * "Changes to this list only apply to cases that haven't progressed past step 1".
 * `shaded` adds a grey background, for a page's read-only notice such as
 * "This session was cancelled on …" (mockups: AdminSessionCancelled).
 */
export function InsetText({ shaded, children }: { shaded?: boolean; children: ReactNode }) {
	return (
		<div className={classNames("bcp-inset-text", shaded && "bcp-inset-text--shaded")}>
			{children}
		</div>
	);
}
