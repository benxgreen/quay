import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CaseStatusTag, SessionStatusTag } from "@/components/service/replacements/status-tag";
import { TagGroup } from "@/components/ui/tag";
import { CASE_STATUSES } from "@/services/replacements/laptops/lib/case-status";

const meta = {
	title: "Service/Replacements/Status tags",
	component: SessionStatusTag,
	args: { status: "open" },
} satisfies Meta<typeof SessionStatusTag>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open, Full (worked out from bookings), Closed and Cancelled. */
export const Sessions: Story = {
	render: () => (
		<TagGroup>
			<SessionStatusTag status="open" />
			<SessionStatusTag status="full" />
			<SessionStatusTag status="closed" />
			<SessionStatusTag status="cancelled" />
		</TagGroup>
	),
};

/** Every case status, in lifecycle order. */
export const Cases: Story = {
	render: () => (
		<TagGroup>
			{CASE_STATUSES.map((status) => (
				<CaseStatusTag key={status} status={status} />
			))}
		</TagGroup>
	),
};
