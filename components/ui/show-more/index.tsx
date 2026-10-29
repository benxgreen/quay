"use client";

import "@/components/ui/button/button.css";
import "./show-more.css";

import { useCallback, useRef, useState } from "react";

type ShowMoreProps = {
	/** How many items are on the page now. */
	shown: number;
	total: number;
	/** Plural noun for the count line: "Showing 20 of 41 cases". */
	noun: string;
	/** Fetches and appends the next batch. Resolves once the new items are rendered. */
	onShowMore: () => Promise<void> | void;
};

/**
 * "Showing X of Y" with a secondary "Show more" button, used for every long
 * list instead of pagination. It is an action, so it is a button. The count
 * is in a live region so the new total is read out.
 *
 * Moving focus to the first new row is the list's job, because only the list
 * knows its rows: see `useShowMoreFocus`.
 *
 * @example
 * <ShowMore shown={rows.length} total={41} noun="cases" onShowMore={loadNext} />
 */
export function ShowMore({ shown, total, noun, onShowMore }: ShowMoreProps) {
	const [loading, setLoading] = useState(false);

	const handleClick = async () => {
		// aria-disabled rather than disabled, so focus is not lost from the button.
		if (loading) {
			return;
		}
		setLoading(true);
		try {
			await onShowMore();
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="bcp-show-more">
			<p className="bcp-show-more-count" aria-live="polite">
				Showing {shown} of {total} {noun}
			</p>
			{shown < total ? (
				<button
					type="button"
					className="bcp-button bcp-button--secondary bcp-show-more-button"
					onClick={handleClick}
					aria-disabled={loading || undefined}
				>
					Show more
				</button>
			) : null}
		</div>
	);
}

/**
 * Remembers which row was first in the new batch and focuses it once it is
 * rendered. Rows need `data-row-id` and `tabIndex={-1}`; the Table
 * component adds both.
 *
 * @example
 * const { containerRef, focusRow } = useShowMoreFocus<HTMLDivElement>();
 * async function loadNext() {
 *   const next = await fetchMore(rows.length);
 *   setRows((current) => [...current, ...next]);
 *   focusRow(next[0]?.id);
 * }
 */
export function useShowMoreFocus<T extends HTMLElement>() {
	const containerRef = useRef<T>(null);

	const focusRow = useCallback((rowId: string | undefined) => {
		if (!rowId) {
			return;
		}
		// Wait for React to commit the appended rows before looking for them.
		requestAnimationFrame(() => {
			const row = containerRef.current?.querySelector<HTMLElement>(
				`[data-row-id="${CSS.escape(rowId)}"]`,
			);
			row?.focus();
		});
	}, []);

	return { containerRef, focusRow };
}
