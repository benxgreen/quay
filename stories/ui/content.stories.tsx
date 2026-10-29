import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Accordion } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkboxes";
import { Details } from "@/components/ui/details";
import { Link } from "@/components/ui/link";
import { StatTiles } from "@/components/ui/stat-tiles";
import { SummaryList } from "@/components/ui/summary-list";
import { Table, TableSecondary } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { Timeline } from "@/components/ui/timeline";

const meta = {
	title: "Components/Content and data",
	component: SummaryList,
	args: {
		rows: [
			{
				key: "Type",
				value: "Session",
				actions: [{ href: "#type", visuallyHiddenText: "type" }],
			},
			{
				key: "Booking",
				value: "Thursday 12 November 2026, 9:30am",
				actions: [{ href: "#booking", visuallyHiddenText: "booking" }],
			},
			{ key: "Old device returned", value: "Not yet" },
		],
	},
} satisfies Meta<typeof SummaryList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Key facts about one thing, with Change links where the team can edit. */
export const SummaryListStory: Story = { name: "Summary list" };

/** Bold-weight headings, a rule under each row, second lines in grey. Numbers right-aligned. */
export const TableStory: Story = {
	name: "Table",
	render: () => (
		<Table
			caption="Cases"
			captionHidden
			columns={[
				{ key: "name", header: "Name" },
				{ key: "type", header: "Type" },
				{ key: "status", header: "Status" },
				{ key: "box", header: "Box number", numeric: true },
			]}
			rows={[
				{
					id: "LR-000118",
					cells: {
						name: (
							<>
								<Link href="#case">Amira Shah</Link>
								<TableSecondary>LR-000118</TableSecondary>
							</>
						),
						type: <TypeTag type="session" />,
						status: <Tag colour="green">Booked</Tag>,
						box: "45821",
					},
				},
				{
					id: "LR-000088",
					cells: {
						name: (
							<>
								<Link href="#case">Chloe Barnes</Link>
								<TableSecondary>LR-000088</TableSecondary>
							</>
						),
						type: <TypeTag type="collection" />,
						status: (
							<>
								<Tag colour="yellow">Pending</Tag>
								<span className="bcp-table-secondary">Flagged · 3 reminders</span>
							</>
						),
						box: "–",
					},
				},
			]}
		/>
	),
};

/** Small checkbox in the first column. Selected rows get a faint tint. */
export const TableWithSelection: Story = {
	render: () => (
		<Table
			caption="Eligible devices"
			columns={[
				{ key: "select", header: <span className="sr-only">Select</span>, checkbox: true },
				{ key: "laptop", header: "Laptop" },
				{ key: "user", header: "Assigned user" },
				{ key: "signIn", header: "Last sign in" },
			]}
			rows={[
				{
					id: "012678233303",
					selected: true,
					cells: {
						select: (
							<Checkbox
								id="select-1"
								name="select"
								value="012678233303"
								label="Select Jordan Blake"
								labelHidden
								small
								defaultChecked
							/>
						),
						laptop: (
							<>
								012678233303<TableSecondary>IT-RyzShXaXsHFL</TableSecondary>
							</>
						),
						user: (
							<>
								Jordan Blake
								<TableSecondary>jordan.blake@bcpcouncil.gov.uk</TableSecondary>
							</>
						),
						signIn: "Today",
					},
				},
				{
					id: "052497844013",
					cells: {
						select: (
							<Checkbox
								id="select-2"
								name="select"
								value="052497844013"
								label="Select Leah Turner"
								labelHidden
								small
							/>
						),
						laptop: (
							<>
								052497844013<TableSecondary>IT-99W6SVBnkBj3</TableSecondary>
							</>
						),
						user: (
							<>
								Leah Turner
								<TableSecondary>leah.turner@bcpcouncil.gov.uk</TableSecondary>
							</>
						),
						signIn: "14 Jul 2026",
					},
				},
			]}
		/>
	),
};

/** Hides secondary information until asked for. */
export const DetailsStory: Story = {
	name: "Details",
	render: () => (
		<Details summary="See 22 hidden laptops">
			<p>This laptop was already replaced in March 2025, recorded in the old workbook.</p>
		</Details>
	),
};

/** Several related sections the reader may want to open one at a time. */
export const AccordionStory: Story = {
	name: "Accordion",
	render: () => (
		<Accordion
			sections={[
				{
					id: "before",
					heading: "Before your session",
					content: (
						<p>
							Back up anything saved on your laptop to OneDrive. Bring your laptop and
							its charger.
						</p>
					),
					open: true,
				},
				{
					id: "day",
					heading: "On the day",
					content: <p>Go to Room 310 at your booked time.</p>,
				},
				{
					id: "return",
					heading: "Returning your old laptop",
					content: <p>Bring your old laptop to the session.</p>,
				},
			]}
		/>
	),
};

/** Headline numbers on the Statistics page. */
export const StatTilesStory: Story = {
	name: "Stat tiles",
	render: () => (
		<StatTiles
			tiles={[
				{
					label: "Laptops in stock",
					value: "34",
					description: "available now, plus 12 allocated to cases",
				},
				{
					label: "Sessions held",
					value: "18",
					description: "11 collections and 7 sessions",
				},
				{
					label: "Replacements completed",
					value: "96",
					description: "old device returned",
				},
				{
					label: "Awaiting old device",
					value: "21",
					description: "new laptop issued, old one not back",
				},
			]}
		/>
	),
};

/** Dated entries, newest first, with who did it underneath. The Journal pattern adds a heading and a note form. */
export const TimelineStory: Story = {
	name: "Timeline",
	render: () => (
		<Timeline
			items={[
				{
					id: "3",
					when: "9 Nov 2026, 11:05am",
					text: "Device allocated: box number 45855 (IT-HLdvJ5dCfWsd)",
					who: "John Smith",
				},
				{
					id: "2",
					when: "2 Nov 2026, 2:41pm",
					text: "Email sent: booking.rebooked to user and team",
					who: "System",
				},
				{
					id: "1",
					when: "26 Oct 2026, 9:00am",
					text: "Email sent: invitation to user",
					who: "System · Send invitations",
				},
			]}
		/>
	),
};

/** Table cells with a second line: grey, a step, or a red flag. */
export const TableSecondLines: Story = {
	render: () => (
		<Table
			caption="Cases"
			captionHidden
			columns={[
				{ key: "name", header: "Name" },
				{ key: "status", header: "Status" },
			]}
			rows={[
				{
					id: "1",
					cells: {
						name: (
							<>
								<Link href="#case">Amira Shah</Link>
								<TableSecondary>LR-000118</TableSecondary>
							</>
						),
						status: (
							<>
								<Tag colour="green">Booked</Tag>
								<TableSecondary variant="step">
									Step 4 of 6: ready to complete
								</TableSecondary>
							</>
						),
					},
				},
				{
					id: "2",
					cells: {
						name: (
							<>
								<Link href="#case">Ravi Menon</Link>
								<TableSecondary>LR-000097</TableSecondary>
							</>
						),
						status: (
							<>
								<Tag colour="orange">Rebook required</Tag>
								<TableSecondary variant="flag">
									Flagged · On annual leave until 23 November
								</TableSecondary>
							</>
						),
					},
				},
			]}
		/>
	),
};
