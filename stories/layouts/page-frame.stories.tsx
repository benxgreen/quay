import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ColleagueLayout } from "@/components/layouts/colleague-layout";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { TeamLayout } from "@/components/layouts/team-layout";
import { ActionList } from "@/components/patterns/action-list";
import { LaptopsPageFrame as LaptopsPage } from "@/components/service/replacements/laptops-page";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Button, ButtonGroup } from "@/components/ui/button";
import { InsetText } from "@/components/ui/inset-text";
import { Link } from "@/components/ui/link";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { Radios } from "@/components/ui/radios";
import { SearchBox } from "@/components/ui/search-box";
import { Sidebar } from "@/components/ui/sidebar";
import { SummaryList } from "@/components/ui/summary-list";
import { Tag } from "@/components/ui/tag";
import { describeRoles, STOP_IMPERSONATING_HREF } from "@/lib/portal/impersonation";
import { menuGroups } from "@/lib/portal/navigation";
import { MOCK_COLLEAGUE, MOCK_TEAM_USER } from "@/mocks/users";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

const meta = {
	title: "Layouts/Page frame",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const teamMenu = menuGroups(MOCK_TEAM_USER.roles);

/** Team list page: heading, the main action underneath, then search. Press Menu to open the team menu. */
export const TeamListPage: Story = {
	render: () => (
		<TeamLayout menu={teamMenu}>
			<LaptopsPage section="cases">
				<PageHeading caption="Laptop replacements" title="Cases">
					<Button href="/manage/replacements/laptops/cases/add">Add a case</Button>
				</PageHeading>
				<SearchBox
					label="Search cases"
					hint="Name, email, serial, hostname or case reference"
				/>
			</LaptopsPage>
		</TeamLayout>
	),
};

/** A team member without the Administrator role sees Services only in the Menu. */
export const TeamListPageNotAdministrator: Story = {
	render: () => (
		<TeamLayout menu={menuGroups(["laptops_team"])}>
			<LaptopsPage section="bookings">
				<PageHeading title="Bookings" />
			</LaptopsPage>
		</TeamLayout>
	),
};

/**
 * While an Administrator impersonates someone, a banner above the header on
 * every page says who, with which roles, and links to stop.
 */
export const TeamPageImpersonating: Story = {
	render: () => (
		<TeamLayout
			menu={menuGroups(["laptops_team"])}
			impersonation={{
				name: "Sam Lee",
				roles: describeRoles(["laptops_team"]),
				stopHref: STOP_IMPERSONATING_HREF,
			}}
		>
			<LaptopsPage section="bookings">
				<PageHeading title="Bookings" />
			</LaptopsPage>
		</TeamLayout>
	),
};

/** A colleague's page while impersonated: the banner says they have no role. */
export const ColleaguePageImpersonating: Story = {
	render: () => (
		<ColleagueLayout
			user={MOCK_COLLEAGUE}
			impersonation={{
				name: MOCK_COLLEAGUE.displayName,
				roles: describeRoles(MOCK_COLLEAGUE.roles),
				stopHref: STOP_IMPERSONATING_HREF,
			}}
		>
			<ColleaguePage>
				<PageHeading title={`Hello, ${MOCK_COLLEAGUE.firstName}`} />
			</ColleaguePage>
		</ColleagueLayout>
	),
};

/** Team detail page: main content with the grey Actions sidebar (up to 320px). */
export const TeamDetailPage: Story = {
	render: () => (
		<TeamLayout menu={teamMenu}>
			<LaptopsPage
				section="cases"
				parents={[LAPTOPS_SECTIONS.cases]}
				sidebar={
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
				}
			>
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
				<h2>Details</h2>
				<SummaryList
					rows={[
						{ key: "Email", value: "priya.hart@bcpcouncil.gov.uk" },
						{
							key: "Booking",
							value: "Thursday 12 November 2026, 9:30am",
							actions: [{ href: "#booking", visuallyHiddenText: "booking" }],
						},
					]}
				/>
			</LaptopsPage>
		</TeamLayout>
	),
};

/** Confirmation page for a case action, as in the AdminActCancelBooking mockup. */
export const ConfirmationPage: Story = {
	render: () => (
		<TeamLayout menu={teamMenu}>
			<LaptopsPage
				section="cases"
				parents={[LAPTOPS_SECTIONS.cases, { text: "Priya Hart", href: "#case" }]}
				narrow
			>
				<PageHeading
					caption="Case LR-000123 · Priya Hart"
					title="Are you sure you want to cancel Priya's booking?"
				/>
				<p>
					Priya's booking for Thursday 12 November 2026 at 9:30am will be cancelled. They
					will be asked to book a new time to replace their device.
				</p>
				<p>
					If you want to remove Priya from the system, you need to{" "}
					<Link href="#withdraw">withdraw their case</Link>.
				</p>
				<InsetText>
					<p>
						The case moves to Rebook required and weekly rebook reminders start. Box
						45855 stays allocated to this case.
					</p>
				</InsetText>
				<ButtonGroup>
					<Button variant="warning" type="submit">
						Cancel booking
					</Button>
					<Link href="#case">Go back</Link>
				</ButtonGroup>
			</LaptopsPage>
		</TeamLayout>
	),
};

/** Colleague page: 1100px container, one column up to 760px, banners above the heading. */
export const ColleaguePageStory: Story = {
	name: "Colleague page",
	render: () => (
		<ColleagueLayout user={MOCK_COLLEAGUE}>
			<ColleaguePage>
				<NotificationBanner variant="success" heading="Booking confirmed">
					<p>Your session is on Thursday 12 November 2026 at 9:30am.</p>
				</NotificationBanner>
				<PageHeading caption="Device portal" title="Your laptop replacement" />
			</ColleaguePage>
		</ColleagueLayout>
	),
};

/** Question page: Back link instead of breadcrumbs, the question as the heading, one green button. */
export const QuestionPage: Story = {
	render: () => (
		<ColleagueLayout user={MOCK_COLLEAGUE}>
			<ColleaguePage backHref="/my">
				<Radios
					name="session"
					caption="Book your laptop replacement"
					legend="Choose a date and time"
					legendSize="xl"
					isPageHeading
					items={[
						{
							value: "1",
							label: "Wednesday 11 November, 10:00am",
							hint: "Room 310, BCP Council Civic Centre, Bournemouth · 2 places left",
						},
						{
							value: "2",
							label: "Thursday 12 November, 9:30am",
							hint: "Room 310, BCP Council Civic Centre, Bournemouth · 4 places left",
						},
					]}
				/>
				<Button type="submit">Continue</Button>
			</ColleaguePage>
		</ColleagueLayout>
	),
};
