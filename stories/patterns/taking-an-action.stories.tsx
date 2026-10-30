import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ActionList } from "@/components/patterns/action-list";
import { Checklist } from "@/components/patterns/checklist";
import { InlineForm } from "@/components/patterns/inline-form";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/ui/sidebar";
import { TextInput } from "@/components/ui/text-input";
import { WarningText } from "@/components/ui/warning-text";

const meta = {
	title: "Patterns/Taking an action",
	component: ActionList,
	args: { items: [] },
} satisfies Meta<typeof ActionList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Actions for a case, session or device in the grey Sidebar, only while
 * there is something to do. Each links to its own confirmation page; see
 * Layouts/Page frame for the confirmation page itself.
 */
export const ActionListStory: Story = {
	name: "Action list",
	render: () => (
		<div style={{ maxWidth: 320 }}>
			<Sidebar label="Case actions">
				<ActionList
					items={[
						{
							text: "Resend booking details",
							href: "#resend",
							description: "Emails the current booking to Priya again",
						},
						{
							text: "Cancel booking",
							href: "#cancel",
							description: "Priya will be asked to rebook",
						},
						{
							text: "Withdraw case",
							href: "#withdraw",
							description: "Closes the case with a reason",
							destructive: true,
						},
					]}
				/>
			</Sidebar>
		</div>
	),
};

/**
 * A checklist on a case step: ticks aren't saved until "Save…" or the
 * primary button, which also moves the case on once everything is ticked.
 * Tick something to see "You have unsaved changes".
 */
export const ChecklistStory: Story = {
	name: "Checklist",
	render: () => (
		<Checklist
			legend="Decommission checklist"
			name="check"
			action={async () => {}}
			saveText="Save decommission checks"
			confirmText="Decommission old device"
			saved="Last saved by John Smith, 12 Nov 2026, 2:15pm"
			beforeButtons={
				<WarningText>This runs the decommission call and cannot be undone.</WarningText>
			}
			items={[
				{ value: "1", label: "Removed from Intune and Autopilot", ticked: true },
				{ value: "2", label: "Disk wiped", ticked: false },
				{ value: "3", label: "Asset label removed", ticked: false },
			]}
		/>
	),
};

/** Adding to a list from under it, such as "Add software" in Settings: fields and the button on one row. */
export const InlineFormStory: Story = {
	name: "Inline form",
	render: () => (
		<form>
			<InlineForm>
				<TextInput id="name" name="name" label="Add software" width="20" />
				<TextInput id="hint" name="hint" label="Hint (optional)" width="30" />
				<Button type="submit">Add</Button>
			</InlineForm>
		</form>
	),
};
