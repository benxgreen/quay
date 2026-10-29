import "./form-group.css";

import type { ReactNode } from "react";
import { classNames } from "@/lib/utils/class-names";

export type LabelSize = "s" | "m" | "l" | "xl";

/**
 * Wraps one question: its label or fieldset, hint, error message and field.
 * With an error it gets the red bar on the left.
 */
export function FormGroup({
	error,
	className,
	children,
}: {
	error?: boolean;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={classNames("bcp-form-group", error && "bcp-form-group--error", className)}>
			{children}
		</div>
	);
}

type FieldsetProps = {
	legend: ReactNode;
	/** Grey context above the legend, such as the journey name on a question page. */
	caption?: ReactNode;
	legendSize?: LabelSize;
	/** Makes the legend the page's h1, for one-question pages. */
	isPageHeading?: boolean;
	describedBy?: string;
	role?: "group";
	children: ReactNode;
};

/**
 * Groups related inputs (radios, checkboxes, the date and time inputs) under
 * one legend. On a one-question page the legend is the page heading.
 */
export function Fieldset({
	legend,
	caption,
	legendSize,
	isPageHeading,
	describedBy,
	role,
	children,
}: FieldsetProps) {
	const legendClassName = classNames(
		"bcp-fieldset-legend",
		legendSize && `bcp-fieldset-legend--${legendSize}`,
	);

	return (
		<fieldset className="bcp-fieldset" aria-describedby={describedBy} role={role}>
			<legend className={legendClassName}>
				{caption ? <span className="bcp-caption">{caption}</span> : null}
				{isPageHeading ? <h1 className="bcp-fieldset-heading">{legend}</h1> : legend}
			</legend>
			{children}
		</fieldset>
	);
}

/** The label for a single field. On a one-question page it is the page heading. */
export function Label({
	htmlFor,
	caption,
	size,
	isPageHeading,
	children,
}: {
	htmlFor: string;
	/** Grey context above the label, such as the case on a confirmation page. */
	caption?: ReactNode;
	size?: LabelSize;
	isPageHeading?: boolean;
	children: ReactNode;
}) {
	const label = (
		<label className={classNames("bcp-label", size && `bcp-label--${size}`)} htmlFor={htmlFor}>
			{children}
		</label>
	);

	return (
		<>
			{caption ? <span className="bcp-caption">{caption}</span> : null}
			{isPageHeading ? <h1 className="bcp-label-wrapper">{label}</h1> : label}
		</>
	);
}

/** Hint text under a label or legend. The `id` is referenced by aria-describedby. */
export function Hint({ id, children }: { id?: string; children: ReactNode }) {
	return (
		<div id={id} className="bcp-hint">
			{children}
		</div>
	);
}
