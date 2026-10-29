import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button, ButtonGroup, InfoButton } from "@/components/ui/button";
import { BackLink, Link } from "@/components/ui/link";

const meta = {
	title: "Components/Buttons and links",
	component: Button,
	args: { children: "Save session" },
	argTypes: {
		variant: { control: "inline-radio", options: ["primary", "secondary", "warning"] },
	},
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The main action on a page. One per page. */
export const Primary: Story = {};

/** Other actions: Find, Clear search, Show more, Print, Refresh from Halo. */
export const Secondary: Story = { args: { variant: "secondary", children: "Refresh from Halo" } };

/** Destructive actions only, always behind a confirmation page. */
export const Warning: Story = { args: { variant: "warning", children: "Withdraw case" } };

export const Disabled: Story = { args: { disabled: true } };

/** A link that looks like a button, for actions that navigate. */
export const AsLink: Story = {
	args: { href: "/manage/replacements/laptops/cases", children: "Add a case" },
};

export const Small: Story = { args: { small: true, children: "Apply filters" } };

/** Main button first, then a secondary button or a Cancel link. */
export const Group: Story = {
	render: () => (
		<ButtonGroup>
			<Button type="submit">Add case</Button>
			<Link href="/manage/replacements/laptops/cases">Cancel</Link>
		</ButtonGroup>
	),
};

/** Opens a modal about a table row. 44px target; the label names the row. */
export const Information: Story = {
	render: () => <InfoButton label="User details for Leah Turner" />,
};

export const TextLinks: Story = {
	render: () => (
		<>
			<p>
				<Link href="/manage/replacements/laptops/cases">An internal link</Link>
			</p>
			<p>
				<Link href="https://www.bcpcouncil.gov.uk" newTab>
					A link that opens in a new tab
				</Link>
			</p>
			<BackLink href="/my" />
		</>
	),
};
