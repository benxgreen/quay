import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ActionList } from "@/components/patterns/action-list";
import { Sidebar } from "@/components/ui/sidebar";

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
