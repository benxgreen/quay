import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Journal } from "@/components/patterns/journal";
import { Tag } from "@/components/ui/tag";

const meta = {
	title: "Patterns/Journal",
	component: Journal,
	args: {
		noteAction: "#journal",
		items: [
			{
				id: "5",
				when: "12 Nov 2026, 10:42am",
				text: "Complete replacement failed: Halo returned 503 Service Unavailable",
				who: "John Smith",
				tag: <Tag colour="red">Failed</Tag>,
			},
			{
				id: "4",
				when: "9 Nov 2026, 11:05am",
				text: "Device allocated: box number 45855 (IT-HLdvJ5dCfWsd)",
				who: "John Smith",
			},
			{
				id: "3",
				when: "2 Nov 2026, 2:41pm",
				text: "Email sent: booking.rebooked to user and team",
				who: "System",
			},
			{
				id: "2",
				when: "2 Nov 2026, 2:41pm",
				text: "Session date changed from Thu 5 Nov, 9:30am to Thu 12 Nov, 9:30am",
				who: "Priya Hart",
			},
			{
				id: "1",
				when: "26 Oct 2026, 9:00am",
				text: "Email sent: invitation to user",
				who: "System · Send invitations",
			},
		],
	},
} satisfies Meta<typeof Journal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The heading, "Add a note" and every entry, newest first, as on the case
 * page. An action whose external call failed is still journaled, with a red
 * Failed tag.
 */
export const Default: Story = {};

/** Read-only, such as on an archived case: no note form. */
export const ReadOnly: Story = { args: { noteAction: undefined } };

export const WithNoteError: Story = { args: { noteError: "Enter a note" } };

export const Empty: Story = { args: { items: [] } };
