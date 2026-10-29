import "./checkboxes.css";

import type { InputHTMLAttributes, ReactNode } from "react";
import { ErrorMessage } from "@/components/ui/error-message";
import { Fieldset, FormGroup, Hint, type LabelSize } from "@/components/ui/form-group";
import { classNames, describedBy } from "@/lib/utils/class-names";

export type CheckboxItem = {
	value: string;
	label: ReactNode;
	hint?: ReactNode;
	/** Extra questions shown under this option when it is ticked. */
	conditional?: ReactNode;
	disabled?: boolean;
};

type CheckboxesProps = {
	name: string;
	/** Id of the first checkbox, which the error summary links to. Defaults to `name`. */
	idPrefix?: string;
	legend: ReactNode;
	caption?: ReactNode;
	legendSize?: LabelSize;
	isPageHeading?: boolean;
	hint?: ReactNode;
	error?: string;
	items: CheckboxItem[];
	/** Values ticked when the page loads. */
	values?: string[];
	small?: boolean;
};

/**
 * Several choices from a list, such as the software someone needs. 40px
 * boxes in forms, 24px (`small`) in filter panels. Ids follow the same
 * pattern as Radios.
 *
 * @example
 * <Checkboxes
 *   name="software"
 *   legend="What software do you need?"
 *   hint="Select all that apply."
 *   items={[{ value: "Adobe Acrobat Pro", label: "Adobe Acrobat Pro" }]}
 * />
 */
export function Checkboxes({
	name,
	idPrefix = name,
	legend,
	caption,
	legendSize,
	isPageHeading,
	hint,
	error,
	items,
	values = [],
	small,
}: CheckboxesProps) {
	const hintId = hint ? `${idPrefix}-hint` : undefined;
	const errorId = error ? `${idPrefix}-error` : undefined;

	return (
		<FormGroup error={!!error}>
			<Fieldset
				legend={legend}
				caption={caption}
				legendSize={legendSize}
				isPageHeading={isPageHeading}
				describedBy={describedBy(hintId, errorId)}
			>
				{hint ? <Hint id={hintId}>{hint}</Hint> : null}
				<ErrorMessage id={errorId}>{error}</ErrorMessage>
				<div className={classNames("bcp-checkboxes", small && "bcp-checkboxes--small")}>
					{items.map((item, index) => {
						const id = index === 0 ? idPrefix : `${idPrefix}-${index + 1}`;
						const itemHintId = item.hint ? `${id}-item-hint` : undefined;
						const conditionalId = item.conditional ? `conditional-${id}` : undefined;

						return (
							<div key={item.value} className="bcp-checkboxes-item-wrapper">
								<div className="bcp-checkboxes-item">
									<input
										className="bcp-checkboxes-input"
										id={id}
										name={name}
										type="checkbox"
										value={item.value}
										defaultChecked={values.includes(item.value)}
										disabled={item.disabled}
										aria-describedby={itemHintId}
										aria-controls={conditionalId}
									/>
									<label className="bcp-checkboxes-label" htmlFor={id}>
										{item.label}
									</label>
									{item.hint ? (
										<div id={itemHintId} className="bcp-checkboxes-hint">
											{item.hint}
										</div>
									) : null}
								</div>
								{item.conditional ? (
									<div className="bcp-checkboxes-conditional" id={conditionalId}>
										{item.conditional}
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			</Fieldset>
		</FormGroup>
	);
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "id"> & {
	id: string;
	label: ReactNode;
	/** Hide the label visually, for example "Select Jordan Blake" in a table row. */
	labelHidden?: boolean;
	small?: boolean;
};

/**
 * A single checkbox outside a group, such as a row selector in a table or a
 * filter like "Flagged only". Controlled or uncontrolled like a native input.
 *
 * @example
 * <Checkbox id="select-LR-000118" name="select" value="LR-000118" label="Select Amira Shah" labelHidden small />
 */
export function Checkbox({ id, label, labelHidden, small, ...props }: CheckboxProps) {
	return (
		<div
			className={classNames(
				"bcp-checkboxes-item",
				"bcp-checkboxes-item--single",
				small && "bcp-checkboxes--small",
				labelHidden && "bcp-checkboxes-item--label-hidden",
			)}
		>
			<input className="bcp-checkboxes-input" id={id} type="checkbox" {...props} />
			<label className="bcp-checkboxes-label" htmlFor={id}>
				{labelHidden ? <span className="sr-only">{label}</span> : label}
			</label>
		</div>
	);
}
