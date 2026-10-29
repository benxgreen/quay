"use client";

import "./error-summary.css";

import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";

export type ErrorSummaryItem = {
	/** The id of the field (or the first input of a group) the error is about. */
	fieldId: string;
	/** The same wording as the message shown on the field. */
	text: string;
};

type ErrorSummaryProps = {
	errors: ErrorSummaryItem[];
	title?: string;
};

/**
 * Goes at the top of the main column when a form has errors. Takes focus
 * when it appears so screen reader users hear it first, and each link moves
 * focus to its field, scrolling the field's label or legend into view.
 *
 * Renders nothing when there are no errors. Pages that show it should also
 * start their `<title>` with "Error: ".
 *
 * @example
 * <ErrorSummary
 *   errors={[
 *     { fieldId: "date-day", text: "Enter a date for the session" },
 *     { fieldId: "capacity", text: "Capacity must be 1 or more" },
 *   ]}
 * />
 */
export function ErrorSummary({ errors, title = "There is a problem" }: ErrorSummaryProps) {
	const ref = useRef<HTMLDivElement>(null);

	// Refocus whenever a new set of errors is shown.
	useEffect(() => {
		if (errors.length > 0) {
			ref.current?.focus();
		}
	}, [errors]);

	if (errors.length === 0) {
		return null;
	}

	return (
		<div ref={ref} className="bcp-error-summary" tabIndex={-1}>
			<div role="alert">
				<h2 className="bcp-error-summary-title">{title}</h2>
				<ul className="bcp-error-summary-list">
					{errors.map((error) => (
						<li key={`${error.fieldId}-${error.text}`}>
							<a
								href={`#${error.fieldId}`}
								onClick={(event) => focusField(event, error.fieldId)}
							>
								{error.text}
							</a>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

function focusField(event: MouseEvent<HTMLAnchorElement>, fieldId: string) {
	const field = document.getElementById(fieldId);
	if (!field) {
		return;
	}
	event.preventDefault();

	// Scroll the question (legend or label) into view rather than the input,
	// so the person can see what the field is for.
	const legend = field.closest("fieldset")?.querySelector("legend");
	const label = document.querySelector(`label[for="${CSS.escape(fieldId)}"]`);
	(legend ?? label ?? field).scrollIntoView();
	field.focus({ preventScroll: true });
}
