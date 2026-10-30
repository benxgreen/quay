import type { ReactNode, TextareaHTMLAttributes } from "react";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormGroup, Hint, Label, type LabelSize } from "@/components/ui/form-group";
import { classNames, describedBy } from "@/lib/utils/class-names";

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> & {
	id: string;
	label: ReactNode;
	caption?: ReactNode;
	labelSize?: LabelSize;
	isPageHeading?: boolean;
	hint?: ReactNode;
	error?: string;
	/** A code font, for Markdown and other text where spacing matters. */
	monospace?: boolean;
};

/**
 * Free text, such as a journal note or a reason.
 *
 * @example
 * <Textarea id="note" name="note" label="Add a note" rows={5} />
 */
export function Textarea({
	id,
	label,
	caption,
	labelSize,
	isPageHeading,
	hint,
	error,
	rows = 5,
	monospace,
	...props
}: TextareaProps) {
	const hintId = hint ? `${id}-hint` : undefined;
	const errorId = error ? `${id}-error` : undefined;

	return (
		<FormGroup error={!!error}>
			<Label htmlFor={id} caption={caption} size={labelSize} isPageHeading={isPageHeading}>
				{label}
			</Label>
			{hint ? <Hint id={hintId}>{hint}</Hint> : null}
			<ErrorMessage id={errorId}>{error}</ErrorMessage>
			<textarea
				id={id}
				rows={rows}
				className={classNames(
					"bcp-textarea",
					monospace && "bcp-textarea--monospace",
					error && "bcp-textarea--error",
				)}
				aria-describedby={describedBy(hintId, errorId)}
				{...props}
			/>
		</FormGroup>
	);
}
