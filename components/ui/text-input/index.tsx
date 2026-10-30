import type { InputHTMLAttributes, ReactNode } from "react";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormGroup, Hint, Label, type LabelSize } from "@/components/ui/form-group";
import { classNames, describedBy } from "@/lib/utils/class-names";

export type InputWidth = "2" | "3" | "4" | "5" | "10" | "20" | "30" | "full";

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
	id: string;
	label: ReactNode;
	caption?: ReactNode;
	labelSize?: LabelSize;
	isPageHeading?: boolean;
	hint?: ReactNode;
	error?: string;
	/** Size the field to the expected answer, in characters. */
	width?: InputWidth;
	/** Words after the field, such as "invitations" or "days after the invitation". */
	suffix?: ReactNode;
};

/**
 * Label, optional hint, error message and the field, with the hint and error
 * linked to the field by aria-describedby. Use `inputMode="numeric"` (not
 * `type="number"`) for numbers such as capacity.
 *
 * @example
 * <TextInput id="capacity" name="capacity" label="Capacity" width="2" inputMode="numeric" />
 */
export function TextInput({
	id,
	label,
	caption,
	labelSize,
	isPageHeading,
	hint,
	error,
	width = "full",
	type = "text",
	suffix,
	...props
}: TextInputProps) {
	const hintId = hint ? `${id}-hint` : undefined;
	const errorId = error ? `${id}-error` : undefined;
	const input = (
		<input
			id={id}
			type={type}
			className={classNames(
				"bcp-input",
				width !== "full" && `bcp-input--width-${width}`,
				error && "bcp-input--error",
			)}
			aria-describedby={describedBy(hintId, errorId)}
			{...props}
		/>
	);

	return (
		<FormGroup error={!!error}>
			<Label htmlFor={id} caption={caption} size={labelSize} isPageHeading={isPageHeading}>
				{label}
			</Label>
			{hint ? <Hint id={hintId}>{hint}</Hint> : null}
			<ErrorMessage id={errorId}>{error}</ErrorMessage>
			{suffix ? (
				<div className="bcp-input-wrapper">
					{input}
					<span className="bcp-input-suffix">{suffix}</span>
				</div>
			) : (
				input
			)}
		</FormGroup>
	);
}
