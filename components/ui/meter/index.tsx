import "./meter.css";

/**
 * A small bar under a figure such as "7 of 10", showing how full something
 * is (mockups: the Booked column on Sessions). It only repeats the figure
 * beside it, so it is hidden from screen readers.
 *
 * @example
 * <>7 of 10<Meter value={7} max={10} /></>
 */
export function Meter({ value, max }: { value: number; max: number }) {
	const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
	return (
		<span className="bcp-meter" aria-hidden="true">
			<span className="bcp-meter-fill" style={{ width: `${percent}%` }} />
		</span>
	);
}
