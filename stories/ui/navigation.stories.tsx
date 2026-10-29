import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button, InfoButton } from "@/components/ui/button";
import { DateNavigation } from "@/components/ui/date-navigation";
import { Link } from "@/components/ui/link";
import { Modal } from "@/components/ui/modal";
import { PageHeading } from "@/components/ui/page-heading";
import { SecondaryNavigation } from "@/components/ui/secondary-navigation";
import { ServiceNavigation } from "@/components/ui/service-navigation";
import { StepList } from "@/components/ui/step-list";
import { Tag } from "@/components/ui/tag";
import {
	LAPTOPS_BREADCRUMBS,
	LAPTOPS_NAVIGATION,
	LAPTOPS_SECTIONS,
} from "@/services/replacements/laptops/navigation";

const meta = {
	title: "Components/Navigation",
	component: SecondaryNavigation,
	parameters: { layout: "fullscreen" },
	args: {
		label: "Import",
		items: [
			{ text: "Eligible devices", href: "/import", count: 38, current: true },
			{ text: "Needs attention", href: "/import/attention", count: 4 },
			{ text: "Invitation queue", href: "/import/queue", count: 41 },
		],
	},
	decorators: [
		(Story) => (
			<div style={{ padding: "1rem" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof SecondaryNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Moves between related pages within a section, such as the Import pages. */
export const Secondary: Story = {};

/** The purple band under the header. Every crumb is a link. */
export const BreadcrumbBand: Story = {
	render: () => <Breadcrumbs items={[...LAPTOPS_BREADCRUMBS, LAPTOPS_SECTIONS.cases]} />,
};

/** Team pages only. Purple underline on the current section. */
export const ServiceNavigationStory: Story = {
	name: "Service navigation",
	render: () => (
		<ServiceNavigation
			label="Laptop replacements"
			links={LAPTOPS_NAVIGATION}
			currentHref={LAPTOPS_SECTIONS.bookings.href}
		/>
	),
};

/** Caption, heading, tags and the main action underneath (not beside it). */
export const PageHeadingStory: Story = {
	name: "Page heading",
	render: () => (
		<>
			<PageHeading caption="Laptop replacements" title="Cases">
				<Button href="/manage/replacements/laptops/cases/add">Add a case</Button>
			</PageHeading>
			<PageHeading
				caption="Case LR-000123"
				title="Priya Hart"
				tags={
					<>
						<Tag colour="green">Booked</Tag>
						<TypeTag type="session" />
					</>
				}
			/>
		</>
	),
};

/** Extra detail without leaving the page. Focus moves in; Escape or Close returns it. */
export const ModalStory: Story = {
	name: "Modal",
	render: () => (
		<Modal
			caption="User details"
			title="Leah Turner"
			trigger={(open) => <InfoButton label="User details for Leah Turner" onClick={open} />}
			footerStart={<Link href="https://halo.example">Open Leah Turner in Halo</Link>}
		>
			<p>Details and devices assigned in Halo go here.</p>
		</Modal>
	),
};

/** Heading on the left, Previous, Today and Next together on the right. */
export const DateNavigationStory: Story = {
	name: "Date navigation",
	render: () => (
		<DateNavigation
			heading="Wednesday 11 November 2026"
			label="Change day"
			previous={{ href: "?day=2026-11-10", text: "Previous day" }}
			current={{ href: "?", text: "Today" }}
			next={{ href: "?day=2026-11-12", text: "Next day" }}
		/>
	),
};

/** Numbered steps: done, current and not started. Every step is always open, with no show or hide. */
export const Steps: Story = {
	render: () => (
		<StepList
			steps={[
				{
					id: "device",
					title: "Replacement device",
					status: "done",
					content: <p>Box number 45855 is allocated to this case.</p>,
				},
				{
					id: "preparation",
					title: "Device preparation",
					status: "current",
					content: (
						<p>
							Checks from Settings, such as changing the primary user and installing
							updates, ticked as each is done.
						</p>
					),
				},
				{
					id: "software",
					title: "Software prepared",
					status: "not-started",
					content: <p>Available after the device has been prepared.</p>,
				},
			]}
		/>
	),
};
