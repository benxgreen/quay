import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tag, TagGroup } from "@/components/ui/tag";

const meta = {
	title: "Components/Tags",
	component: Tag,
	args: { children: "Booked", colour: "green" },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One colour per status, used the same way everywhere (from the mockups' Components page). */
export const Statuses: Story = {
	render: () => (
		<TagGroup>
			<Tag colour="grey">Queued</Tag>
			<Tag colour="yellow">Pending</Tag>
			<Tag colour="blue">Unbooked</Tag>
			<Tag colour="green">Booked</Tag>
			<Tag colour="orange">Rebook required</Tag>
			<Tag colour="turquoise">Awaiting return</Tag>
			<Tag colour="pink">Awaiting decommission</Tag>
			<Tag colour="green">Prepared</Tag>
			<Tag colour="grey">Not prepared</Tag>
			<Tag colour="red">Full</Tag>
		</TagGroup>
	),
};
