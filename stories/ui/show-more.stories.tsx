import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { ShowMore, useShowMoreFocus } from "@/components/ui/show-more";
import { Table } from "@/components/ui/table";

const meta = {
	title: "Components/Show more",
	component: ShowMore,
	args: { shown: 20, total: 41, noun: "cases", onShowMore: () => {} },
} satisfies Meta<typeof ShowMore>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const ALL = Array.from({ length: 23 }, (_, index) => ({
	id: `LR-${String(100 + index).padStart(6, "0")}`,
	name: `Colleague ${index + 1}`,
}));

/**
 * Loads the next batch in place, reads out the new count and moves focus to
 * the first new row. Tab after "Show more" to see where focus lands.
 */
export const WithATable: Story = {
	render: function Render() {
		const [rows, setRows] = useState(ALL.slice(0, 10));
		const { containerRef, focusRow } = useShowMoreFocus<HTMLDivElement>();

		async function loadNext() {
			await new Promise((resolve) => setTimeout(resolve, 300));
			const next = ALL.slice(rows.length, rows.length + 10);
			setRows((current) => [...current, ...next]);
			focusRow(next[0]?.id);
		}

		return (
			<div ref={containerRef}>
				<Table
					caption="Cases"
					columns={[
						{ key: "name", header: "Name" },
						{ key: "reference", header: "Case" },
					]}
					rows={rows.map((row) => ({
						id: row.id,
						cells: { name: row.name, reference: row.id },
					}))}
				/>
				<ShowMore
					shown={rows.length}
					total={ALL.length}
					noun="cases"
					onShowMore={loadNext}
				/>
			</div>
		);
	},
};
