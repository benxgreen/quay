import "@/components/ui/button/button.css";
import "./filter-bar.css";

import type { ReactNode } from "react";

type FilterBarProps = {
	/** Accessible name for the search landmark. */
	label: string;
	/** Where the form submits (GET). Defaults to the current page. */
	action?: string;
	/** The fields, such as a TextInput and Selects. */
	children: ReactNode;
};

/**
 * A search with a few filters in one grey row, with a secondary Search
 * button (mockups: AdminUsers). Submits a GET, so the filters live in the
 * URL and the back button works. For longer filter lists, use FilterPanel.
 *
 * @example
 * <FilterBar label="Users">
 *   <TextInput id="q" name="q" label="Search by name, email or username" />
 *   <Select id="role" name="role" label="Role" options={…} />
 * </FilterBar>
 */
export function FilterBar({ label, action, children }: FilterBarProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: role="search" on the form has wider assistive technology support than <search>
		<form
			className="bcp-filter-bar"
			role="search"
			aria-label={label}
			method="get"
			action={action}
		>
			{children}
			<button
				className="bcp-button bcp-button--secondary bcp-filter-bar-button"
				type="submit"
			>
				Search
			</button>
		</form>
	);
}
