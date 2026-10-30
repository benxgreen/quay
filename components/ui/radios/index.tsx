import "./radios.css";

import type { ReactNode } from "react";
import { ErrorMessage } from "@/components/ui/error-message";
import { Fieldset, FormGroup, Hint, type LabelSize } from "@/components/ui/form-group";
import { classNames, describedBy } from "@/lib/utils/class-names";

export type RadioItem =
	| {
			value: string;
			label: ReactNode;
			hint?: ReactNode;
			/** Extra questions shown under this option when it is chosen. Keep to one or two. */
			conditional?: ReactNode;
			disabled?: boolean;
	  }
	| {
			/** Text between options, usually "or". */
			divider: string;
	  }
	| {
			/** A heading over the options that follow, such as "Week starting 9 November 2026". */
			heading: string;
	  };

type RadiosProps = {
	name: string;
	/** Id of the first radio, which the error summary links to. Defaults to `name`. */
	idPrefix?: string;
	legend: ReactNode;
	caption?: ReactNode;
	legendSize?: LabelSize;
	isPageHeading?: boolean;
	hint?: ReactNode;
	error?: string;
	items: RadioItem[];
	/** The value checked when the page loads. */
	value?: string;
	inline?: boolean;
	small?: boolean;
};

/**
 * One choice from a few options, with a hint under each where it helps.
 *
 * The first radio's id is `idPrefix` and the rest are `idPrefix-2`,
 * `idPrefix-3`… as in GOV.UK Frontend, so the error summary can link to the
 * group. Conditional content is revealed with CSS (`:has(:checked)`), so it
 * works without JavaScript and stays a server component.
 *
 * @example
 * <Radios
 *   name="type"
 *   legend="Type"
 *   items={[
 *     { value: "collection", label: "Collection", hint: "Colleagues pick up a laptop that is already set up" },
 *     { value: "session", label: "Session", hint: "An engineer sets up the laptop with the colleague" },
 *   ]}
 * />
 */
export function Radios({
	name,
	idPrefix = name,
	legend,
	caption,
	legendSize,
	isPageHeading,
	hint,
	error,
	items,
	value,
	inline,
	small,
}: RadiosProps) {
	const hintId = hint ? `${idPrefix}-hint` : undefined;
	const errorId = error ? `${idPrefix}-error` : undefined;
	let position = 0;

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
				<div
					className={classNames(
						"bcp-radios",
						inline && "bcp-radios--inline",
						small && "bcp-radios--small",
					)}
				>
					{items.map((item) => {
						if ("heading" in item) {
							return (
								<p key={`heading-${item.heading}`} className="bcp-radios-heading">
									{item.heading}
								</p>
							);
						}
						if ("divider" in item) {
							return (
								<div key={`divider-${item.divider}`} className="bcp-radios-divider">
									{item.divider}
								</div>
							);
						}
						position += 1;
						const id = position === 1 ? idPrefix : `${idPrefix}-${position}`;
						const itemHintId = item.hint ? `${id}-item-hint` : undefined;
						const conditionalId = item.conditional ? `conditional-${id}` : undefined;

						return (
							<div key={item.value} className="bcp-radios-item-wrapper">
								<div className="bcp-radios-item">
									<input
										className="bcp-radios-input"
										id={id}
										name={name}
										type="radio"
										value={item.value}
										defaultChecked={value === item.value}
										disabled={item.disabled}
										aria-describedby={itemHintId}
										aria-controls={conditionalId}
									/>
									<label className="bcp-radios-label" htmlFor={id}>
										{item.label}
									</label>
									{item.hint ? (
										<div id={itemHintId} className="bcp-radios-hint">
											{item.hint}
										</div>
									) : null}
								</div>
								{item.conditional ? (
									<div className="bcp-radios-conditional" id={conditionalId}>
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
