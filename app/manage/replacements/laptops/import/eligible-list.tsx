"use client";

import { useState } from "react";
import { SelectionBar } from "@/components/patterns/selection-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkboxes";
import { Radios } from "@/components/ui/radios";
import { ShowMore, useShowMoreFocus } from "@/components/ui/show-more";
import { Table, TableSecondary } from "@/components/ui/table";
import { formatLongDate } from "@/lib/dates/format";
import type { IsoDate } from "@/lib/dates/working-days";
import { addSelectedToQueue } from "./actions";
import { UserDetails } from "./user-details";

export type EligibleRow = {
	assetId: string;
	serial: string;
	hostname: string;
	model: string;
	purchased: string;
	lastSeen: string;
	lastSignIn: string;
	name: string;
	email: string;
};

type EligibleListProps = {
	rows: EligibleRow[];
	/** Cases already queued, for when the selection would be invited. */
	queued: number;
	perDay: number;
	runDays: IsoDate[];
	error?: "select" | "type";
	pageSize?: number;
};

const plural = (n: number) => `${n} laptop${n === 1 ? "" : "s"}`;

/**
 * Eligible laptops with checkboxes, "Select all", Show more and the bar to
 * add the selection to the invitation queue (mockups: AdminImport). The
 * selection is kept in hidden fields, so rows not yet shown still count.
 */
export function EligibleList({
	rows,
	queued,
	perDay,
	runDays,
	error,
	pageSize = 20,
}: EligibleListProps) {
	const [selected, setSelected] = useState<string[]>([]);
	const [shown, setShown] = useState(pageSize);
	const { containerRef, focusRow } = useShowMoreFocus<HTMLDivElement>();
	const allSelected = rows.length > 0 && selected.length === rows.length;

	const toggle = (assetId: string, on: boolean) =>
		setSelected((current) =>
			on ? [...current, assetId] : current.filter((id) => id !== assetId),
		);

	const lastPosition = queued + selected.length;
	const invited = runDays[Math.ceil(lastPosition / perDay) - 1];

	return (
		<form action={addSelectedToQueue}>
			{selected.map((assetId) => (
				<input key={assetId} type="hidden" name="asset" value={assetId} />
			))}
			<div ref={containerRef}>
				<Table
					caption="Eligible devices"
					captionHidden
					empty="No laptops match. Try changing the search or filters."
					columns={[
						{
							key: "select",
							checkbox: true,
							header: (
								<Checkbox
									id="select-all"
									label={`Select all ${plural(rows.length)}`}
									labelHidden
									small
									checked={allSelected}
									onChange={(event) =>
										setSelected(
											event.target.checked
												? rows.map((row) => row.assetId)
												: [],
										)
									}
								/>
							),
						},
						{ key: "laptop", header: "Laptop" },
						{ key: "user", header: "Assigned user" },
						{ key: "model", header: "Model" },
						{ key: "purchased", header: "Purchase date" },
						{ key: "seen", header: "Last seen" },
						{ key: "signIn", header: "Last sign in" },
						{ key: "details", header: <span className="sr-only">User details</span> },
					]}
					rows={rows.slice(0, shown).map((row) => ({
						id: row.assetId,
						selected: selected.includes(row.assetId),
						cells: {
							select: (
								<Checkbox
									id={`select-${row.assetId}`}
									label={`Select ${row.name}, ${row.hostname}`}
									labelHidden
									small
									checked={selected.includes(row.assetId)}
									onChange={(event) => toggle(row.assetId, event.target.checked)}
								/>
							),
							laptop: (
								<>
									{row.serial}
									<TableSecondary>
										{row.hostname} · asset {row.assetId}
									</TableSecondary>
								</>
							),
							user: (
								<>
									{row.name}
									<TableSecondary>{row.email}</TableSecondary>
								</>
							),
							model: row.model,
							purchased: row.purchased,
							seen: row.lastSeen,
							signIn: row.lastSignIn,
							details: (
								<UserDetails
									name={row.name}
									email={row.email}
									assetId={row.assetId}
								/>
							),
						},
					}))}
				/>
				{rows.length > 0 ? (
					<ShowMore
						shown={Math.min(shown, rows.length)}
						total={rows.length}
						noun="laptops"
						onShowMore={() => {
							const firstNew = rows[shown]?.assetId;
							setShown((current) => current + pageSize);
							focusRow(firstNew);
						}}
					/>
				) : null}
			</div>

			<SelectionBar
				count={
					selected.length > 0
						? `${plural(selected.length)} selected`
						: "No laptops selected"
				}
				action={
					<Button type="submit">
						{selected.length > 0
							? `Add ${selected.length} to invitation queue`
							: "Add to invitation queue"}
					</Button>
				}
				note={
					selected.length > 0 && invited
						? `${queued} ${queued === 1 ? "case is" : "cases are"} already queued. At ${perDay} a working day, ${
								selected.length === 1 ? "this one" : `these ${selected.length}`
							} would be invited by ${formatLongDate(invited)}.`
						: undefined
				}
			>
				<Radios
					name="type"
					legend="Type"
					legendSize="s"
					inline
					small
					error={error === "type" ? "Select the type for these laptops" : undefined}
					items={[
						{ value: "collection", label: "Collection" },
						{ value: "session", label: "Session" },
					]}
				/>
			</SelectionBar>
		</form>
	);
}
