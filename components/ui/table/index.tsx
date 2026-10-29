import "./table.css";

import type { ReactNode } from "react";
import { useId } from "react";
import { classNames } from "@/lib/utils/class-names";

export type TableColumn = {
	key: string;
	header: ReactNode;
	/** Right-aligns the column, for numbers. */
	numeric?: boolean;
	/** Narrow column holding a row's checkbox. */
	checkbox?: boolean;
};

export type TableRow = {
	id: string;
	cells: Record<string, ReactNode>;
	/** Tints the row, for example when its checkbox is ticked. */
	selected?: boolean;
};

type TableProps = {
	/** Names the table. Pass `captionHidden` when a heading above already says it. */
	caption: ReactNode;
	captionHidden?: boolean;
	columns: TableColumn[];
	rows: TableRow[];
	/** Shown in place of the rows when there are none. */
	empty?: ReactNode;
};

/**
 * A data table that scrolls sideways inside its own box on narrow screens.
 * The scrolling box is focusable and labelled by the caption so keyboard
 * users can scroll it too.
 *
 * Each row's first cell is a row header. Pass row ids that stay the same as
 * rows are added, so "Show more" can move focus to the first new one.
 */
export function Table({ caption, captionHidden, columns, rows, empty }: TableProps) {
	const captionId = useId();
	const [first, ...rest] = columns;

	return (
		// biome-ignore lint/a11y/noNoninteractiveTabindex: the scroll box must be focusable so keyboard users can scroll a wide table
		// biome-ignore lint/a11y/useSemanticElements: GOV.UK's scrollable table pattern; a <section> would add a landmark per table
		<div className="bcp-table-wrapper" role="region" aria-labelledby={captionId} tabIndex={0}>
			<table className="bcp-table">
				<caption
					id={captionId}
					className={classNames("bcp-table-caption", captionHidden && "sr-only")}
				>
					{caption}
				</caption>
				<thead>
					<tr>
						{columns.map((column) => (
							<th key={column.key} scope="col" className={cellClassName(column)}>
								{column.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.length === 0 && empty ? (
						<tr>
							<td colSpan={columns.length}>{empty}</td>
						</tr>
					) : null}
					{rows.map((row) => (
						<tr
							key={row.id}
							data-row-id={row.id}
							tabIndex={-1}
							className={classNames(row.selected && "bcp-table-row--selected")}
						>
							{first ? (
								first.checkbox ? (
									<td className={cellClassName(first)}>{row.cells[first.key]}</td>
								) : (
									<th
										scope="row"
										className={classNames(
											"bcp-table-row-header",
											cellClassName(first),
										)}
									>
										{row.cells[first.key]}
									</th>
								)
							) : null}
							{rest.map((column) => (
								<td key={column.key} className={cellClassName(column)}>
									{row.cells[column.key]}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function cellClassName(column: TableColumn): string | undefined {
	return (
		classNames(
			column.numeric && "bcp-table-cell--numeric",
			column.checkbox && "bcp-table-cell--checkbox",
		) || undefined
	);
}

/**
 * A second line inside a table cell: grey, such as the case reference under
 * a name or "Step 4 of 6" under a status; or red (`flag`), such as
 * "Flagged · 3 reminders".
 */
export function TableSecondary({
	variant = "default",
	children,
}: {
	variant?: "default" | "step" | "flag";
	children: ReactNode;
}) {
	return (
		<span
			className={classNames(
				"bcp-table-secondary",
				variant !== "default" && `bcp-table-secondary--${variant}`,
			)}
		>
			{children}
		</span>
	);
}
