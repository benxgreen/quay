import "./selection-bar.css";

import type { ReactNode } from "react";

type SelectionBarProps = {
	/** "3 laptops selected", announced as it changes. */
	count: ReactNode;
	/** Choices for the selection, such as the type radios. */
	children?: ReactNode;
	/** The action, such as "Add 3 to invitation queue". */
	action: ReactNode;
	/** A note under everything, such as when they would be invited. */
	note?: ReactNode;
};

/**
 * The bar under a list where rows are ticked, with how many are selected,
 * any choices for them and the action (mockups: AdminImport, the "Add to
 * invitation queue" bar).
 */
export function SelectionBar({ count, children, action, note }: SelectionBarProps) {
	return (
		<div className="bcp-selection-bar">
			<div className="bcp-selection-bar-choices">
				<p className="bcp-selection-bar-count" aria-live="polite">
					{count}
				</p>
				{children}
			</div>
			<div className="bcp-selection-bar-action">{action}</div>
			{note ? <p className="bcp-selection-bar-note">{note}</p> : null}
		</div>
	);
}
