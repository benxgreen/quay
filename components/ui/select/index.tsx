import "./select.css";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormGroup, Hint, Label, type LabelSize } from "@/components/ui/form-group";
import { classNames, describedBy } from "@/lib/utils/class-names";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className"> & {
	id: string;
	label: ReactNode;
	labelSize?: LabelSize;
	hint?: ReactNode;
	error?: string;
	options: SelectOption[];
	/** An empty first option, such as "Choose a device". Off by default. */
	placeholder?: string;
};

/**
 * A native select, for filters and short fixed lists. In a form with only a
 * few options, use radios instead.
 *
 * @example
 * <Select
 *   id="status"
 *   name="status"
 *   label="Status"
 *   options={[{ value: "open", label: "All open cases" }, { value: "pending", label: "Pending" }]}
 * />
 */
export function Select({
	id,
	label,
	labelSize,
	hint,
	error,
	options,
	placeholder,
	...props
}: SelectProps) {
	const hintId = hint ? `${id}-hint` : undefined;
	const errorId = error ? `${id}-error` : undefined;

	return (
		<FormGroup error={!!error}>
			<Label htmlFor={id} size={labelSize}>
				{label}
			</Label>
			{hint ? <Hint id={hintId}>{hint}</Hint> : null}
			<ErrorMessage id={errorId}>{error}</ErrorMessage>
			<select
				id={id}
				className={classNames("bcp-select", error && "bcp-select--error")}
				aria-describedby={describedBy(hintId, errorId)}
				{...props}
			>
				{placeholder !== undefined ? <option value="">{placeholder}</option> : null}
				{options.map((option) => (
					<option key={option.value} value={option.value} disabled={option.disabled}>
						{option.label}
					</option>
				))}
			</select>
		</FormGroup>
	);
}
