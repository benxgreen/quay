import "@/components/ui/button/button.css";
import "@/components/ui/form-group/form-group.css";
import "./search-box.css";

import type { ReactNode } from "react";

type SearchBoxProps = {
	id?: string;
	/** Query parameter name. */
	name?: string;
	label: string;
	hint?: string;
	defaultValue?: string;
	/** Where the search submits to. Defaults to the current page. */
	action?: string;
	/** Hidden fields to keep, such as the current filters. */
	hiddenFields?: Record<string, string>;
	/** Sits beside the search, for example the "Show filters" button. */
	aside?: ReactNode;
};

/**
 * The main search on a team list page: a large label and hint, with the
 * Search button joined to the field. Submits a GET so results can be
 * bookmarked and the back button works.
 *
 * @example
 * <SearchBox label="Search cases" hint="Name, email, serial, hostname or case reference" />
 */
export function SearchBox({
	id = "q",
	name = "q",
	label,
	hint,
	defaultValue,
	action,
	hiddenFields,
	aside,
}: SearchBoxProps) {
	const hintId = hint ? `${id}-hint` : undefined;

	return (
		// biome-ignore lint/a11y/useSemanticElements: role="search" on the form has wider assistive technology support than <search>
		<form className="bcp-search-box" role="search" method="get" action={action}>
			<div className="bcp-search-box-field">
				<label className="bcp-search-box-label" htmlFor={id}>
					{label}
				</label>
				{hint ? (
					<div id={hintId} className="bcp-search-box-hint">
						{hint}
					</div>
				) : null}
				<div className="bcp-search-box-row">
					<input
						className="bcp-input bcp-search-box-input"
						id={id}
						name={name}
						type="search"
						defaultValue={defaultValue}
						aria-describedby={hintId}
						spellCheck={false}
					/>
					<button className="bcp-button bcp-search-box-button" type="submit">
						Search
					</button>
				</div>
			</div>
			{hiddenFields
				? Object.entries(hiddenFields).map(([key, value]) => (
						<input key={key} type="hidden" name={key} value={value} />
					))
				: null}
			{aside ? <div className="bcp-search-box-aside">{aside}</div> : null}
		</form>
	);
}
