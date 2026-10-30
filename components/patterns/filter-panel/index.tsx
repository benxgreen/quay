"use client";

import "@/components/ui/button/button.css";
import "@/components/ui/form-group/form-group.css";
import "@/components/ui/search-box/search-box.css";
import "@/components/ui/link/link.css";
import "./filter-panel.css";

import NextLink from "next/link";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkboxes";

type FilterPanelProps = {
	/** The search box above the filters. Leave out for filters only, such as Statistics. */
	search?: {
		label: string;
		hint?: string;
		/** Query parameter name. Defaults to "q". */
		name?: string;
		defaultValue?: string;
	};
	/** Where the form submits. Defaults to the current page. */
	action?: string;
	/** Link that removes every filter, usually the page without a query string. */
	clearHref: string;
	/** Open the panel when the page loads, for example when filters are applied. */
	defaultOpen?: boolean;
	/** Buttons beside "Show filters" when there is no search, such as "Download as CSV". */
	actions?: ReactNode;
	/** Hidden fields to keep, such as the current view. */
	hiddenFields?: Record<string, string>;
	/** The filters: FilterGrid, FilterOptions and ColumnChooser. */
	children: ReactNode;
};

/**
 * The default for team lists: a search box with a "Show filters" button.
 * The filters open in a panel underneath and apply when the person selects
 * Apply filters. Search and filters are one GET form, so results can be
 * bookmarked and the back button works.
 *
 * @example
 * <FilterPanel search={{ label: "Search cases", hint: "Name, email, serial, hostname or case reference" }} clearHref="/manage/replacements/laptops/cases">
 *   <FilterGrid>…selects…</FilterGrid>
 *   <FilterOptions>…small checkboxes…</FilterOptions>
 * </FilterPanel>
 */
export function FilterPanel({
	search,
	action,
	clearHref,
	defaultOpen = false,
	hiddenFields,
	actions,
	children,
}: FilterPanelProps) {
	const [open, setOpen] = useState(defaultOpen);
	const panelId = useId();
	const searchId = useId();
	const name = search?.name ?? "q";
	const hintId = search?.hint ? `${searchId}-hint` : undefined;

	return (
		<form
			className="bcp-filter-panel"
			role={search ? "search" : undefined}
			aria-label={search ? undefined : "Filters"}
			method="get"
			action={action}
		>
			{search ? (
				<div className="bcp-search-box">
					<div className="bcp-search-box-field">
						<label className="bcp-search-box-label" htmlFor={searchId}>
							{search.label}
						</label>
						{search.hint ? (
							<div id={hintId} className="bcp-search-box-hint">
								{search.hint}
							</div>
						) : null}
						<div className="bcp-search-box-row">
							<input
								className="bcp-input bcp-search-box-input"
								id={searchId}
								name={name}
								type="search"
								defaultValue={search.defaultValue}
								aria-describedby={hintId}
								spellCheck={false}
							/>
							<button className="bcp-button bcp-search-box-button" type="submit">
								Search
							</button>
						</div>
					</div>
					<div className="bcp-search-box-aside">
						<button
							type="button"
							className="bcp-button bcp-button--secondary bcp-filter-panel-toggle"
							aria-expanded={open}
							aria-controls={panelId}
							onClick={() => setOpen((current) => !current)}
						>
							{open ? "Hide filters" : "Show filters"}
						</button>
					</div>
				</div>
			) : (
				<div className="bcp-filter-panel-bar">
					<button
						type="button"
						className="bcp-button bcp-button--secondary bcp-filter-panel-toggle"
						aria-expanded={open}
						aria-controls={panelId}
						onClick={() => setOpen((current) => !current)}
					>
						{open ? "Hide filters" : "Show filters"}
					</button>
					{actions}
				</div>
			)}
			{hiddenFields
				? Object.entries(hiddenFields).map(([key, value]) => (
						<input key={key} type="hidden" name={key} value={value} />
					))
				: null}
			<div id={panelId} className="bcp-filter-panel-body" hidden={!open}>
				{children}
				<div className="bcp-filter-panel-actions">
					<button type="submit" className="bcp-button bcp-button--small">
						Apply filters
					</button>
					<NextLink className="bcp-link" href={clearHref}>
						Clear filters
					</NextLink>
				</div>
			</div>
		</form>
	);
}

/** Selects in a row of three inside a FilterPanel. Use Select for each. */
export function FilterGrid({ children }: { children: ReactNode }) {
	return <div className="bcp-filter-grid">{children}</div>;
}

/** A row of small checkboxes, such as "Flagged only", under a rule. Use Checkbox with `small`. */
export function FilterOptions({ children }: { children: ReactNode }) {
	return <div className="bcp-filter-options">{children}</div>;
}

type ColumnChooserProps = {
	/** Field name; each ticked column is submitted as a value. */
	name: string;
	legend?: string;
	hint?: string;
	columns: Array<{ value: string; label: string }>;
	/** Columns shown now. */
	values: string[];
};

/**
 * Inside a FilterPanel: which table columns to show. Ticked columns are
 * submitted with the filters, so the choice lives in the URL.
 *
 * @example
 * <ColumnChooser name="columns" hint="Name is always shown." columns={[{ value: "email", label: "Email" }]} values={["email"]} />
 */
export function ColumnChooser({
	name,
	legend = "Columns",
	hint,
	columns,
	values,
}: ColumnChooserProps) {
	const hintId = useId();

	return (
		<fieldset className="bcp-column-chooser" aria-describedby={hint ? hintId : undefined}>
			<legend className="bcp-column-chooser-legend">{legend}</legend>
			{hint ? (
				<div id={hintId} className="bcp-column-chooser-hint">
					{hint}
				</div>
			) : null}
			<div className="bcp-filter-options bcp-filter-options--plain">
				{columns.map((column) => (
					<Checkbox
						key={column.value}
						id={`${name}-${column.value}`}
						name={name}
						value={column.value}
						label={column.label}
						defaultChecked={values.includes(column.value)}
						small
					/>
				))}
			</div>
		</fieldset>
	);
}
