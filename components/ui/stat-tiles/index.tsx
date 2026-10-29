import "./stat-tiles.css";

import type { ReactNode } from "react";

export type StatTile = {
	label: ReactNode;
	value: ReactNode;
	/** A short line under the number, such as "11 collections and 7 sessions". */
	description?: ReactNode;
};

/**
 * Headline numbers, such as on a statistics page. Tiles sit in a row of
 * three or four, two on narrower screens and one on phones.
 *
 * @example
 * <StatTiles tiles={[{ label: "Laptops in stock", value: "34", description: "available now" }]} />
 */
export function StatTiles({ tiles, columns = 4 }: { tiles: StatTile[]; columns?: 3 | 4 }) {
	return (
		<dl className={`bcp-stat-tiles bcp-stat-tiles--${columns}`}>
			{tiles.map((tile, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: tiles have no id and keep their order
				<div key={index} className="bcp-stat-tile">
					<dt className="bcp-stat-tile-label">{tile.label}</dt>
					<dd className="bcp-stat-tile-value">{tile.value}</dd>
					{tile.description ? (
						<dd className="bcp-stat-tile-description">{tile.description}</dd>
					) : null}
				</div>
			))}
		</dl>
	);
}
