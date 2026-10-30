import "./bar-chart.css";

export type BarValue = { label: string; value: number };

/**
 * Amounts by name as horizontal bars, largest first, such as bookings per
 * application. One series, so one colour and no legend; every bar has its
 * number written beside it, and the list reads as text without the bars.
 *
 * @example
 * <BarList label="Bookings by application" items={[{ label: "Adobe Acrobat Pro", value: 58 }]} unit="bookings" />
 */
export function BarList({
	label,
	items,
	unit,
}: {
	/** Names the list for screen readers. */
	label: string;
	items: BarValue[];
	/** Plural noun for the tooltip, such as "bookings". */
	unit: string;
}) {
	const max = Math.max(1, ...items.map((item) => item.value));
	return (
		<ul className="bcp-bar-list" aria-label={label}>
			{items.map((item) => (
				<li key={item.label} className="bcp-bar-list-item">
					<span className="bcp-bar-list-label">{item.label}</span>
					<span
						className="bcp-bar-list-track"
						title={`${item.label}: ${item.value} ${unit}`}
					>
						<span
							className="bcp-bar-list-bar"
							style={{ width: `${(item.value / max) * 100}%` }}
							aria-hidden="true"
						/>
						<span className="bcp-bar-list-value">{item.value}</span>
					</span>
				</li>
			))}
		</ul>
	);
}

/**
 * Amounts across a short fixed sequence as columns, such as bookings by
 * weekday. A picture for sighted readers (described in one sentence for
 * screen readers); always pair it with a table of the same numbers.
 */
export function ColumnChart({
	description,
	items,
	unit,
}: {
	/** Read out instead of the columns, such as "Bookings by weekday: Monday 16, …". */
	description: string;
	items: BarValue[];
	unit: string;
}) {
	const max = Math.max(1, ...items.map((item) => item.value));
	return (
		<figure className="bcp-column-chart">
			<div className="bcp-column-chart-plot" role="img" aria-label={description}>
				{items.map((item) => (
					<div
						key={item.label}
						className="bcp-column-chart-column"
						title={`${item.label}: ${item.value} ${unit}`}
					>
						<span className="bcp-column-chart-value">{item.value}</span>
						<span
							className="bcp-column-chart-bar"
							style={{ height: `${(item.value / max) * 100}%` }}
						/>
					</div>
				))}
			</div>
			<div className="bcp-column-chart-labels" aria-hidden="true">
				{items.map((item) => (
					<span key={item.label}>{item.label.slice(0, 3)}</span>
				))}
			</div>
		</figure>
	);
}
