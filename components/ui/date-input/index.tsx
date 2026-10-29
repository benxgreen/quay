import "./date-input.css";

import type { ReactNode } from "react";
import { ErrorMessage } from "@/components/ui/error-message";
import { Fieldset, FormGroup, Hint, type LabelSize } from "@/components/ui/form-group";
import { classNames, describedBy } from "@/lib/utils/class-names";

export type DatePart = "day" | "month" | "year";

export type DateValue = { day?: string; month?: string; year?: string };

type DateInputProps = {
	/** Inputs are named `${name}-day`, `${name}-month` and `${name}-year`, with the same ids. */
	name: string;
	legend: ReactNode;
	caption?: ReactNode;
	legendSize?: LabelSize;
	isPageHeading?: boolean;
	hint?: ReactNode;
	error?: string;
	/** Which boxes to outline in red. All three when `error` is set and this is not. */
	errorParts?: DatePart[];
	/** What the person typed, kept as text so an invalid entry is shown back as entered. */
	value?: DateValue;
};

const PARTS: Array<{ part: DatePart; label: string; width: "2" | "4" }> = [
	{ part: "day", label: "Day", width: "2" },
	{ part: "month", label: "Month", width: "2" },
	{ part: "year", label: "Year", width: "4" },
];

/**
 * Day, Month and Year boxes in a fieldset. Never a date picker on its own.
 * The error summary should link to the first box with an error, for example
 * `${name}-day`.
 *
 * @example
 * <DateInput name="date" legend="Date" hint="For example, 12 11 2026" />
 */
export function DateInput({
	name,
	legend,
	caption,
	legendSize,
	isPageHeading,
	hint,
	error,
	errorParts,
	value = {},
}: DateInputProps) {
	const hintId = hint ? `${name}-hint` : undefined;
	const errorId = error ? `${name}-error` : undefined;
	const partsWithError = error ? (errorParts ?? PARTS.map((p) => p.part)) : [];

	return (
		<FormGroup error={!!error}>
			<Fieldset
				legend={legend}
				caption={caption}
				legendSize={legendSize}
				isPageHeading={isPageHeading}
				describedBy={describedBy(hintId, errorId)}
				role="group"
			>
				{hint ? <Hint id={hintId}>{hint}</Hint> : null}
				<ErrorMessage id={errorId}>{error}</ErrorMessage>
				<div className="bcp-date-input">
					{PARTS.map(({ part, label, width }) => (
						<DateInputItem
							key={part}
							id={`${name}-${part}`}
							label={label}
							width={width}
							defaultValue={value[part]}
							hasError={partsWithError.includes(part)}
						/>
					))}
				</div>
			</Fieldset>
		</FormGroup>
	);
}

/** One box of a date or time input. Shared with TimeInput. */
export function DateInputItem({
	id,
	label,
	width,
	defaultValue,
	hasError,
}: {
	id: string;
	label: string;
	width: "2" | "4";
	defaultValue?: string;
	hasError?: boolean;
}) {
	return (
		<div className="bcp-date-input-item">
			<label className="bcp-date-input-label" htmlFor={id}>
				{label}
			</label>
			<input
				className={classNames(
					"bcp-input",
					`bcp-input--width-${width}`,
					hasError && "bcp-input--error",
				)}
				id={id}
				name={id}
				type="text"
				inputMode="numeric"
				spellCheck={false}
				autoComplete="off"
				defaultValue={defaultValue}
			/>
		</div>
	);
}
