import "./summary-list.css";

import type { ReactNode } from "react";
import { Link } from "@/components/ui/link";
import { classNames } from "@/lib/utils/class-names";

export type SummaryListAction = {
	href: string;
	/** Visible link text, usually "Change". */
	text?: string;
	/** Says what is being changed, for screen reader users: "booking". */
	visuallyHiddenText: string;
};

export type SummaryListRow = {
	key: ReactNode;
	value: ReactNode;
	actions?: SummaryListAction[];
};

/**
 * Key facts about one thing, with Change links where they can be edited.
 * Unlike Harbour's version there is no "Not answered" fallback: pass the
 * value you want shown.
 *
 * @example
 * <SummaryList
 *   rows={[
 *     { key: "Type", value: "Session", actions: [{ href: "#", visuallyHiddenText: "type" }] },
 *     { key: "Old device returned", value: "Not yet" },
 *   ]}
 * />
 */
export function SummaryList({
	rows,
	noBorder,
	compact,
}: {
	rows: SummaryListRow[];
	noBorder?: boolean;
	/** Smaller text and tighter rows, for use inside a box such as a LookupResult. */
	compact?: boolean;
}) {
	const anyActions = rows.some((row) => row.actions?.length);

	return (
		<dl
			className={classNames(
				"bcp-summary-list",
				!anyActions && "bcp-summary-list--no-actions",
				noBorder && "bcp-summary-list--no-border",
				compact && "bcp-summary-list--compact",
			)}
		>
			{rows.map((row, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: keys can be any ReactNode, so the row position is the stable key
					key={index}
					className={classNames(
						"bcp-summary-list-row",
						anyActions && !row.actions?.length && "bcp-summary-list-row--no-actions",
					)}
				>
					<dt className="bcp-summary-list-key">{row.key}</dt>
					<dd className="bcp-summary-list-value">{row.value}</dd>
					{row.actions?.length ? (
						<dd className="bcp-summary-list-actions">
							{row.actions.map((action) => (
								<Link
									key={action.href + action.visuallyHiddenText}
									href={action.href}
								>
									{action.text ?? "Change"}{" "}
									<span className="sr-only">{action.visuallyHiddenText}</span>
								</Link>
							))}
						</dd>
					) : null}
				</div>
			))}
		</dl>
	);
}

/** A grey second line inside a summary list value, such as an explanation under "Session". */
export function SummaryListSecondary({ children }: { children: ReactNode }) {
	return <span className="bcp-summary-list-secondary">{children}</span>;
}
