import "./applied-filters.css";

import NextLink from "next/link";
import { useId } from "react";

export type AppliedFilter = {
	/** What the chip says, such as "Status: Booked". */
	text: string;
	/** The current page's URL without this filter. */
	removeHref: string;
};

/**
 * Each applied filter as a removable chip above the results, with Clear
 * filters at the end. Each chip is a link to the page without that filter.
 * Renders nothing when no filters are applied.
 *
 * @example
 * <AppliedFilters filters={[{ text: "Status: Booked", removeHref: "?type=session" }]} clearHref="/manage/replacements/laptops/cases" />
 */
export function AppliedFilters({
	filters,
	clearHref,
}: {
	filters: AppliedFilter[];
	clearHref: string;
}) {
	const labelId = useId();

	if (filters.length === 0) {
		return null;
	}

	return (
		<div className="bcp-applied-filters">
			<span className="bcp-applied-filters-label" id={labelId}>
				Filtered by:
			</span>
			<ul className="bcp-applied-filters-list" aria-labelledby={labelId}>
				{filters.map((filter) => (
					<li key={filter.removeHref + filter.text}>
						<NextLink className="bcp-applied-filters-chip" href={filter.removeHref}>
							{filter.text}
							<span className="bcp-applied-filters-remove" aria-hidden="true">
								×
							</span>{" "}
							<span className="sr-only">Remove filter</span>
						</NextLink>
					</li>
				))}
			</ul>
			<NextLink className="bcp-applied-filters-clear" href={clearHref}>
				Clear filters
			</NextLink>
		</div>
	);
}
