import "@/components/ui/date-input/date-input.css";

import type { ReactNode } from "react";
import { DateInputItem } from "@/components/ui/date-input";
import { ErrorMessage } from "@/components/ui/error-message";
import { Fieldset, FormGroup, Hint, type LabelSize } from "@/components/ui/form-group";
import { describedBy } from "@/lib/utils/class-names";

export type TimePart = "hour" | "minute";

type TimeInputProps = {
	/** Inputs are named `${name}-hour` and `${name}-minute`, with the same ids. */
	name: string;
	legend: ReactNode;
	legendSize?: LabelSize;
	hint?: ReactNode;
	error?: string;
	/** Which boxes to outline in red. Both when `error` is set and this is not. */
	errorParts?: TimePart[];
	value?: { hour?: string; minute?: string };
};

/**
 * Hour and Minute boxes in a fieldset, like the date input. Used because the
 * Design System has no time component and native time pickers behave
 * inconsistently with assistive technology.
 *
 * @example
 * <TimeInput name="start" legend="Start time" />
 */
export function TimeInput({
	name,
	legend,
	legendSize,
	hint = "Use the 24-hour clock, for example 14 30",
	error,
	errorParts,
	value = {},
}: TimeInputProps) {
	const hintId = hint ? `${name}-hint` : undefined;
	const errorId = error ? `${name}-error` : undefined;
	const partsWithError: TimePart[] = error ? (errorParts ?? ["hour", "minute"]) : [];

	return (
		<FormGroup error={!!error}>
			<Fieldset
				legend={legend}
				legendSize={legendSize}
				describedBy={describedBy(hintId, errorId)}
				role="group"
			>
				{hint ? <Hint id={hintId}>{hint}</Hint> : null}
				<ErrorMessage id={errorId}>{error}</ErrorMessage>
				<div className="bcp-date-input">
					<DateInputItem
						id={`${name}-hour`}
						label="Hour"
						width="2"
						defaultValue={value.hour}
						hasError={partsWithError.includes("hour")}
					/>
					<DateInputItem
						id={`${name}-minute`}
						label="Minute"
						width="2"
						defaultValue={value.minute}
						hasError={partsWithError.includes("minute")}
					/>
				</div>
			</Fieldset>
		</FormGroup>
	);
}
