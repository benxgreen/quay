import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AddAnother } from "@/components/patterns/add-another";
import { LookupField, LookupResult } from "@/components/patterns/lookup-field";
import { Button } from "@/components/ui/button";
import { Fieldset, Hint } from "@/components/ui/form-group";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { Tag } from "@/components/ui/tag";

const meta = {
	title: "Patterns/Question pages",
	component: LookupField,
	args: { id: "serial", label: "Serial number", buttonText: "Find device" },
} satisfies Meta<typeof LookupField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Type one value, press Find, and the rest is filled in. */
export const LookupFieldStory: Story = {
	name: "Lookup field",
	render: () => (
		<LookupField
			id="serial"
			name="serial"
			label="Serial number"
			hint="Usually on a sticker underneath the laptop"
			defaultValue="041587226390"
			buttonText="Find device"
			buttonName="action"
			buttonValue="find"
		>
			<LookupResult
				title="IT-Tq8MvR2sXk7N"
				tag={<Tag colour="green">Found in Halo</Tag>}
				confirmation="No active case for this device and not previously replaced."
			>
				<SummaryList
					compact
					rows={[
						{ key: "Asset ID", value: "31958" },
						{ key: "Model", value: "Surface Laptop 3" },
						{
							key: "Assigned user in Halo",
							value: (
								<>
									Adam Kerr
									<SummaryListSecondary>
										adam.kerr@bcpcouncil.gov.uk
									</SummaryListSecondary>
								</>
							),
						},
					]}
				/>
			</LookupResult>
		</LookupField>
	),
};

/** Repeating free-text boxes, one item per box. */
export const AddAnotherStory: Story = {
	name: "Add another",
	render: () => (
		<Fieldset legend={<h2 className="bcp-heading-md">Other software</h2>}>
			<Hint>If something you need is not listed, add it here. One per box.</Hint>
			<AddAnother
				name="otherSoftware"
				itemLabel="Software"
				defaultValues={["Planning Portal connector"]}
			/>
		</Fieldset>
	),
};

/** Summary list of everything entered with Change links, then confirm. */
export const CheckAnswers: Story = {
	render: () => (
		<div style={{ maxWidth: 680 }}>
			<h2>Your booking</h2>
			<SummaryList
				rows={[
					{ key: "Laptop being replaced", value: "Serial 006943877382" },
					{
						key: "Type",
						value: (
							<>
								Session
								<SummaryListSecondary>
									An engineer sets up your new laptop with you.
								</SummaryListSecondary>
							</>
						),
					},
					{
						key: "Date and time",
						value: "Thursday 12 November 2026 at 9:30am",
						actions: [{ href: "#date", visuallyHiddenText: "date and time" }],
					},
				]}
			/>
			<h2>Confirm your booking</h2>
			<p>We will email a confirmation to john.smith@bcpcouncil.gov.uk.</p>
			<Button type="submit">Confirm booking</Button>
		</div>
	),
};
