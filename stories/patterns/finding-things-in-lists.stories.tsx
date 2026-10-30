import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppliedFilters } from "@/components/patterns/applied-filters";
import { FilterBar } from "@/components/patterns/filter-bar";
import {
	ColumnChooser,
	FilterGrid,
	FilterOptions,
	FilterPanel,
} from "@/components/patterns/filter-panel";
import { GroupHeading } from "@/components/patterns/group-heading";
import { SelectionBar } from "@/components/patterns/selection-bar";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkboxes";
import { Link } from "@/components/ui/link";
import { Radios } from "@/components/ui/radios";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { TextInput } from "@/components/ui/text-input";

const meta = {
	title: "Patterns/Finding things in lists",
	component: FilterPanel,
} satisfies Meta<typeof FilterPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A search with a few filters in one grey row, as on Users. For a longer
 * list of filters, use the filter panel.
 */
export const FilterBarStory: Story = {
	args: { search: { label: "" }, clearHref: "#", children: null },
	name: "Filter bar",
	render: () => (
		<FilterBar label="Users">
			<TextInput id="q" name="q" label="Search by name, email or username" type="search" />
			<Select
				id="role"
				name="role"
				label="Role"
				options={[
					{ value: "", label: "All roles" },
					{ value: "administrator", label: "Administrator" },
					{ value: "none", label: "Colleague (no role)" },
				]}
			/>
			<Select
				id="show"
				name="show"
				label="Show"
				options={[
					{ value: "directory", label: "Everyone in the directory" },
					{ value: "portal", label: "Portal users only" },
				]}
			/>
		</FilterBar>
	),
};

/** Under a list with ticked rows: how many, any choices for them, and the action (Import). */
export const SelectionBarStory: Story = {
	args: { search: { label: "" }, clearHref: "#", children: null },
	name: "Selection bar",
	render: () => (
		<SelectionBar
			count="3 laptops selected"
			action={<Button type="submit">Add 3 to invitation queue</Button>}
			note="41 cases are already queued. At 15 a working day, these 3 would be invited by Monday 16 November."
		>
			<Radios
				name="type"
				legend="Type"
				legendSize="s"
				inline
				small
				items={[
					{ value: "collection", label: "Collection" },
					{ value: "session", label: "Session" },
				]}
			/>
		</SelectionBar>
	),
};

/** A list loaded whole but shown 20 at a time, with Show more (the invitation queue). */
export const ShowMoreTableStory: Story = {
	args: { search: { label: "" }, clearHref: "#", children: null },
	name: "Show more table",
	render: () => (
		<ShowMoreTable
			caption="Invitation queue"
			captionHidden
			noun="cases"
			pageSize={3}
			columns={[
				{ key: "position", header: "No.", numeric: true },
				{ key: "person", header: "Person" },
			]}
			rows={["Ben Whitaker", "Sam Fuller", "Aisha Begum", "Ruth Collins", "Leah Turner"].map(
				(name, index) => ({
					id: String(index + 1),
					cells: { position: index + 1, person: name },
				}),
			)}
		/>
	),
};

/** Search with a "Show filters" button; filters open in a panel underneath. */
export const SearchWithFilters: Story = {
	args: { search: { label: "Search cases" }, clearHref: "#", children: null },
	render: () => (
		<FilterPanel
			search={{
				label: "Search cases",
				hint: "Name, email, serial, hostname or case reference",
			}}
			clearHref="/manage/replacements/laptops/cases"
			defaultOpen
		>
			<FilterGrid>
				<Select
					id="sort"
					name="sort"
					label="Sort by"
					options={[
						{ value: "next", label: "Next session date" },
						{ value: "name", label: "Name" },
						{ value: "added", label: "Date added" },
						{ value: "status", label: "Status" },
					]}
				/>
				<Select
					id="status"
					name="status"
					label="Status"
					options={[
						{ value: "open", label: "All open cases" },
						{ value: "pending", label: "Pending" },
						{ value: "booked", label: "Booked" },
					]}
				/>
				<Select
					id="type"
					name="type"
					label="Type"
					options={[
						{ value: "", label: "All types" },
						{ value: "collection", label: "Collection" },
						{ value: "session", label: "Session" },
					]}
				/>
			</FilterGrid>
			<FilterOptions>
				<Checkbox id="flagged" name="flagged" value="1" label="Flagged only" small />
				<Checkbox
					id="no-device"
					name="noDevice"
					value="1"
					label="No device allocated"
					small
				/>
				<Checkbox
					id="archived"
					name="archived"
					value="1"
					label="Include archived cases"
					small
				/>
			</FilterOptions>
			<ColumnChooser
				name="columns"
				hint="Name is always shown."
				columns={[
					{ value: "device", label: "Old device" },
					{ value: "type", label: "Type" },
					{ value: "status", label: "Status" },
					{ value: "email", label: "Email" },
				]}
				values={["device", "type", "status"]}
			/>
		</FilterPanel>
	),
};

/** Each applied filter as a removable chip above the results. */
export const AppliedFiltersStory: Story = {
	args: { search: { label: "" }, clearHref: "#", children: null },
	name: "Applied filters",
	render: () => (
		<AppliedFilters
			filters={[
				{ text: "Status: Booked", removeHref: "?flagged=1" },
				{ text: "Flagged only", removeHref: "?status=booked" },
			]}
			clearHref="?"
		/>
	),
};

/** Splits a long table into groups, such as sessions on the bookings dashboard. */
export const GroupHeadingStory: Story = {
	args: { search: { label: "" }, clearHref: "#", children: null },
	name: "Group heading",
	render: () => (
		<>
			<GroupHeading
				before={<TypeTag type="session" />}
				title="9:30am"
				meta="Room 310, BCP Council Civic Centre, Bournemouth · 5 of 5 booked"
				after={<Tag colour="red">Full</Tag>}
				action={<Link href="#session">View session</Link>}
			/>
			<Table
				caption="Session at 9:30am"
				captionHidden
				columns={[
					{ key: "name", header: "Name" },
					{ key: "case", header: "Case" },
					{ key: "device", header: "Device" },
				]}
				rows={[
					{
						id: "1",
						cells: {
							name: "Amira Shah",
							case: <Link href="#case">LR-000118</Link>,
							device: <Tag colour="green">Prepared</Tag>,
						},
					},
				]}
			/>
		</>
	),
};
