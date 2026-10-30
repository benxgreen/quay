import "./preview.css";

import type { ReactNode } from "react";

/**
 * A bordered box showing what something will look like before it is
 * saved, such as page content or an email, with a grey strip above for
 * details like the subject.
 *
 * @example
 * <Preview label="Preview of the Session page content"><MarkdownText markdown={body} /></Preview>
 */
export function Preview({
	label,
	meta,
	children,
}: {
	/** Names the region for screen readers. */
	label: string;
	/** The strip above, such as "Subject: Your laptop replacement". */
	meta?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="bcp-preview" aria-label={label}>
			{meta ? <div className="bcp-preview-meta">{meta}</div> : null}
			<div className="bcp-preview-body">{children}</div>
		</section>
	);
}
