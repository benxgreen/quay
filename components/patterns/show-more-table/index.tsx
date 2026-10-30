"use client";

import { type ReactNode, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { ShowMore, useShowMoreFocus } from "@/components/ui/show-more";
import { Table, type TableColumn, type TableRow } from "@/components/ui/table";

type ShowMoreTableProps = {
	caption: ReactNode;
	captionHidden?: boolean;
	columns: TableColumn[];
	/** Every row; the table shows `pageSize` at a time. */
	rows: TableRow[];
	/** Plural noun for "Showing 20 of 41 cases". */
	noun: string;
	pageSize?: number;
	empty?: ReactNode;
};

/**
 * A table whose rows are all on the page but shown a batch at a time, with
 * "Show more" and "Showing X of Y" (focus moves to the first new row). For
 * lists that are loaded whole, such as the invitation queue; a list fetched
 * in batches uses ShowMore directly. Printing shows every row.
 */
export function ShowMoreTable({
	caption,
	captionHidden,
	columns,
	rows,
	noun,
	pageSize = 20,
	empty,
}: ShowMoreTableProps) {
	const [shown, setShown] = useState(pageSize);
	const { containerRef, focusRow } = useShowMoreFocus<HTMLDivElement>();
	const visible = rows.slice(0, shown);

	// A printout has every row, not just the batches shown so far.
	useEffect(() => {
		const showAll = () => flushSync(() => setShown(Number.POSITIVE_INFINITY));
		window.addEventListener("beforeprint", showAll);
		return () => window.removeEventListener("beforeprint", showAll);
	}, []);

	return (
		<div ref={containerRef}>
			<Table
				caption={caption}
				captionHidden={captionHidden}
				columns={columns}
				rows={visible}
				empty={empty}
			/>
			{rows.length > 0 ? (
				<ShowMore
					shown={visible.length}
					total={rows.length}
					noun={noun}
					onShowMore={() => {
						const firstNew = rows[shown]?.id;
						setShown((current) => current + pageSize);
						focusRow(firstNew);
					}}
				/>
			) : null}
		</div>
	);
}
