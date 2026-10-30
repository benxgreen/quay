import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox, Checkboxes } from "@/components/ui/checkboxes";
import { DateInput } from "@/components/ui/date-input";
import { Radios } from "@/components/ui/radios";
import { SearchBox } from "@/components/ui/search-box";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/tag";
import { TextInput } from "@/components/ui/text-input";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time-input";

const meta = {
	title: "Components/Form inputs",
	component: TextInput,
	args: { id: "location", name: "location", label: "Location", hint: "Building and room" },
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Label, optional hint, then the field. Size the width to the expected answer. */
export const TextInputStory: Story = { name: "Text input" };

export const TextInputWidth: Story = {
	name: "Text input, fixed width",
	args: {
		id: "capacity",
		name: "capacity",
		label: "Capacity",
		hint: undefined,
		width: "2",
		inputMode: "numeric",
	},
};

/** Words after the field, such as a unit. */
export const TextInputSuffix: Story = {
	name: "Text input with suffix",
	args: {
		id: "invitations",
		name: "invitations",
		label: "Invitations per working day",
		hint: undefined,
		width: "3",
		inputMode: "numeric",
		defaultValue: "15",
		suffix: "invitations",
	},
};

/** The same message appears in the error summary. */
export const TextInputError: Story = {
	name: "Text input with error",
	args: {
		id: "capacity",
		name: "capacity",
		label: "Capacity",
		hint: undefined,
		width: "2",
		inputMode: "numeric",
		defaultValue: "0",
		error: "Capacity must be 1 or more",
	},
};

/** Day, month and year boxes in a fieldset. Never a date picker on its own. */
export const DateStory: Story = {
	name: "Date",
	render: () => <DateInput name="date" legend="Date" hint="For example, 12 11 2026" />,
};

export const DateError: Story = {
	name: "Date with error",
	render: () => (
		<DateInput
			name="date"
			legend="Date"
			hint="For example, 12 11 2026"
			error="Date must include a year"
			errorParts={["year"]}
			value={{ day: "12", month: "11" }}
		/>
	),
};

/** Hour and Minute boxes, 24-hour clock. */
export const TimeStory: Story = {
	name: "Time",
	render: () => <TimeInput name="start" legend="Start time" />,
};

/** For filters and short fixed lists. */
export const SelectStory: Story = {
	name: "Select",
	render: () => (
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
	),
};

export const TextareaStory: Story = {
	name: "Textarea",
	render: () => <Textarea id="note" name="note" label="Add a note" />,
};

/** A code font for Markdown, where spacing matters. */
export const TextareaMonospace: Story = {
	name: "Textarea, monospace",
	render: () => (
		<Textarea
			id="content"
			name="content"
			label="Content"
			monospace
			rows={6}
			defaultValue={"## Before your session\n\n- bring your laptop\n- bring its charger"}
		/>
	),
};

/** One choice from a few options, with hints under each. */
export const RadiosStory: Story = {
	name: "Radios",
	render: () => (
		<Radios
			name="type"
			legend="Type"
			legendSize="m"
			items={[
				{
					value: "collection",
					label: "Collection",
					hint: "Colleagues pick up a laptop that is already set up",
				},
				{
					value: "session",
					label: "Session",
					hint: "An engineer sets up the laptop with the colleague",
				},
			]}
		/>
	),
};

/** Extra questions under the chosen radio. Only for one or two simple questions. */
export const RadiosConditional: Story = {
	name: "Radios with conditional reveal",
	render: () => (
		<Radios
			name="reason"
			legend="Why can you not attend?"
			legendSize="l"
			value="other"
			items={[
				{ value: "non_standard_hours", label: "I work non-standard days or hours" },
				{ value: "away_for_all_dates", label: "I am away for all of the dates offered" },
				{
					value: "other",
					label: "Something else",
					conditional: (
						<Textarea
							id="reason-other"
							name="reasonOther"
							label="Tell us why you cannot attend"
							hint="Include when you are available, so we can arrange a time."
						/>
					),
				},
			]}
		/>
	),
};

/** The "or" option at the end of the change-date page. */
export const RadiosDivider: Story = {
	name: "Radios with divider",
	render: () => (
		<Radios
			name="session"
			legend="Choose a new date and time"
			items={[
				{ value: "1", label: "Wednesday 11 November, 10:00am", hint: "2 places left" },
				{ value: "2", label: "Friday 13 November, 10am", hint: "Full", disabled: true },
				{ divider: "or" },
				{ value: "none", label: "I am not available for any of these dates" },
			]}
		/>
	),
};

/** 40px boxes for forms. Tags can sit inside the label. */
export const CheckboxesStory: Story = {
	name: "Checkboxes",
	render: () => (
		<Checkboxes
			name="software"
			legend="What software do you need?"
			legendSize="l"
			hint="Select all that apply."
			values={["Adobe Acrobat Pro"]}
			items={[
				{
					value: "Adobe Acrobat Pro",
					label: "Adobe Acrobat Pro",
					hint: "Used for editing and signing PDFs. This software requires a licence.",
				},
				{
					value: "AutoCAD LT",
					label: (
						<>
							AutoCAD LT <Tag colour="light-blue">Requested</Tag>
						</>
					),
				},
				{ value: "Microsoft Project", label: "Microsoft Project" },
			]}
		/>
	),
};

/** 24px boxes in filter panels and tables. Always a real label, hidden if needed. */
export const CheckboxSmall: Story = {
	name: "Checkbox, small",
	render: () => (
		<>
			<Checkbox id="flagged" name="flagged" label="Flagged only" small />
			<br />
			<Checkbox id="select-row" name="select" label="Select Jordan Blake" labelHidden small />
		</>
	),
};

/** The main search on a list page, with the Search button joined to the field. */
export const Search: Story = {
	render: () => (
		<SearchBox
			label="Search cases"
			hint="Name, email, serial, hostname or case reference"
			aside={
				<button type="button" className="bcp-button bcp-button--secondary">
					Show filters
				</button>
			}
		/>
	),
};
