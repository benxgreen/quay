import "@/components/ui/button/button.css";
import "./lookup-field.css";

import type { InputHTMLAttributes, ReactNode } from "react";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormGroup, Hint, Label } from "@/components/ui/form-group";
import { classNames, describedBy } from "@/lib/utils/class-names";

type LookupFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
	id: string;
	label: ReactNode;
	hint?: ReactNode;
	error?: string;
	/** The button text, such as "Find device". */
	buttonText: string;
	/** Name and value of the submit button, so the page knows a lookup was asked for. */
	buttonName?: string;
	buttonValue?: string;
	/** The result: a LookupResult. */
	children?: ReactNode;
};

/**
 * Type one value, press Find, and the rest is filled in. The result shows
 * underneath in a grey box. To look up something else, edit the field and
 * press Find again. The button submits the form; the page does the lookup.
 *
 * @example
 * <LookupField id="serial" name="serial" label="Serial number" buttonText="Find device" buttonName="action" buttonValue="find">
 *   <LookupResult title="IT-RyzShXaXsHFL" tag={<Tag colour="green">Found in Halo</Tag>} confirmation="Not in the workflow and not replaced before." />
 * </LookupField>
 */
export function LookupField({
	id,
	label,
	hint,
	error,
	buttonText,
	buttonName,
	buttonValue,
	children,
	...props
}: LookupFieldProps) {
	const hintId = hint ? `${id}-hint` : undefined;
	const errorId = error ? `${id}-error` : undefined;

	return (
		<FormGroup error={!!error}>
			<Label htmlFor={id}>{label}</Label>
			{hint ? <Hint id={hintId}>{hint}</Hint> : null}
			<ErrorMessage id={errorId}>{error}</ErrorMessage>
			<div className="bcp-lookup-field">
				<input
					id={id}
					type="text"
					autoComplete="off"
					spellCheck={false}
					className={classNames(
						"bcp-input",
						"bcp-lookup-field-input",
						error && "bcp-input--error",
					)}
					aria-describedby={describedBy(hintId, errorId)}
					{...props}
				/>
				<button
					type="submit"
					className="bcp-button bcp-button--secondary"
					name={buttonName}
					value={buttonValue}
				>
					{buttonText}
				</button>
			</div>
			{children ? <div aria-live="polite">{children}</div> : null}
		</FormGroup>
	);
}

type LookupResultProps = {
	/** What was found, such as the hostname. */
	title: ReactNode;
	/** Such as a green "Found in Halo" tag. */
	tag?: ReactNode;
	/** On the right, such as a link to the record. */
	action?: ReactNode;
	/** Details of what was found, such as a compact SummaryList. */
	children?: ReactNode;
	/** The green confirmation line, such as "No active case for this device." */
	confirmation?: ReactNode;
};

/** The grey box under a LookupField showing what was found. */
export function LookupResult({ title, tag, action, children, confirmation }: LookupResultProps) {
	return (
		<div className="bcp-lookup-result">
			<div className="bcp-lookup-result-top">
				<strong className="bcp-lookup-result-title">{title}</strong>
				{tag}
				{action ? <span className="bcp-lookup-result-action">{action}</span> : null}
			</div>
			{children}
			{confirmation ? (
				<p className="bcp-lookup-result-confirmation">
					<svg
						width="20"
						height="20"
						viewBox="0 0 20 20"
						aria-hidden="true"
						focusable="false"
					>
						<path
							d="M4 10.5l4 4 8-9"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
						/>
					</svg>
					{confirmation}
				</p>
			) : null}
		</div>
	);
}
