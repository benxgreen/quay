import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ActionList } from "@/components/patterns/action-list";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/ui/footer";
import { Header } from "@/components/ui/header";
import { HeaderMenu } from "@/components/ui/header-menu";
import { Sidebar } from "@/components/ui/sidebar";
import { SidebarLayout } from "@/components/ui/sidebar-layout";

const meta = {
	title: "Components/Layout",
	component: Container,
	parameters: { layout: "fullscreen" },
	args: { children: null },
} satisfies Meta<typeof Container>;

export default meta;
type Story = StoryObj<typeof meta>;

function Box({ label }: { label: string }) {
	return (
		<div style={{ background: "#ebe9ee", padding: "12px 16px", marginBottom: 8 }}>{label}</div>
	);
}

/** The council logo linking home. Add `bordered` when no coloured band follows it. */
export const HeaderStory: Story = {
	name: "Header",
	render: () => (
		<Header homeHref="/my" homeLabel="BCP Council Device portal" bordered>
			<p style={{ margin: 0 }}>
				Hi John <span style={{ color: "#505a5f" }}>(john.smith@bcpcouncil.gov.uk)</span>
			</p>
		</Header>
	),
};

/** The header with a Menu that opens underneath and pushes the page down. */
export const HeaderWithMenu: Story = {
	render: () => (
		<HeaderMenu
			homeHref="/manage"
			homeLabel="BCP Council Device portal"
			groups={[
				{
					title: "Services",
					links: [
						{ text: "Laptop replacements", href: "#laptops" },
						{ text: "Smartphone replacements", href: "#smartphones" },
						{ text: "New starters", href: "#new-starters" },
					],
				},
				{
					title: "Management",
					links: [
						{ text: "Users", href: "#users" },
						{ text: "Portal settings", href: "#portal-settings" },
					],
				},
			]}
		/>
	),
};

export const FooterStory: Story = {
	name: "Footer",
	render: () => <Footer />,
};

/** Harbour's width tiers, including gutters: full 1260, large 1100, medium 820. */
export const ContainerWidths: Story = {
	render: () => (
		<>
			{(["full", "large", "medium"] as const).map((width) => (
				<Container key={width} width={width}>
					<Box label={`width="${width}"`} />
				</Container>
			))}
		</>
	),
};

/** Content narrowed inside a container: half 820, third 540. */
export const ContentWidths: Story = {
	render: () => (
		<>
			{(["full", "half", "third"] as const).map((contentWidth) => (
				<Container key={contentWidth} width="full" contentWidth={contentWidth}>
					<Box label={`contentWidth="${contentWidth}"`} />
				</Container>
			))}
		</>
	),
};

/** Main content with a sidebar of up to 320px at the end, such as case actions. */
export const SidebarEnd: Story = {
	render: () => (
		<Container width="full">
			<SidebarLayout
				sidebar={
					<Sidebar label="Case actions">
						<ActionList
							items={[
								{
									text: "Resend booking details",
									href: "#resend",
									description: "Emails the current booking again",
								},
							]}
						/>
					</Sidebar>
				}
			>
				<Box label="Main content" />
			</SidebarLayout>
		</Container>
	),
};

/** A sidebar at the start, such as list filters. It follows the main content on phones. */
export const SidebarStart: Story = {
	render: () => (
		<Container width="full">
			<SidebarLayout
				position="start"
				sidebar={
					<Sidebar label="Filters">
						<h2>Filters</h2>
					</Sidebar>
				}
			>
				<Box label="Main content" />
			</SidebarLayout>
		</Container>
	),
};
