import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ErrorSummary } from "@/components/ui/error-summary";
import { InsetText } from "@/components/ui/inset-text";
import { Link } from "@/components/ui/link";
import { Note } from "@/components/ui/note";
import { NotificationBanner, NotificationBannerDetail } from "@/components/ui/notification-banner";
import { Panel } from "@/components/ui/panel";
import { WarningText } from "@/components/ui/warning-text";

const meta = {
	title: "Components/Messages",
	component: NotificationBanner,
	args: { heading: "Booking confirmed" },
} satisfies Meta<typeof NotificationBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Confirms what the person just did, at the top of the page they land on. */
export const Success: Story = {
	args: {
		variant: "success",
		heading: "Booking confirmed",
		children: (
			<p>
				Your session is on Thursday 12 November 2026 at 9:30am. We have emailed a
				confirmation to john.smith@bcpcouncil.gov.uk.
			</p>
		),
	},
};

/** When a call to Halo, the decommission hook or Power Automate fails. Nothing was changed. */
export const Failed: Story = {
	args: {
		variant: "failed",
		heading: "Replacement not completed",
		children: (
			<>
				<p>
					Halo could not be updated, so nothing has been changed. Box 45855 is still in
					stock in Halo and the case is still on step 4.
				</p>
				<NotificationBannerDetail>
					Halo returned 503 Service Unavailable at 9:52am.{" "}
					<Link href="/manage/replacements/laptops/settings">Connection log</Link>
				</NotificationBannerDetail>
				<p>Try again. If it keeps failing, check the connection in Settings.</p>
			</>
		),
	},
};

/** Something the colleague needs to know first, such as a cancelled session. */
export const Important: Story = {
	args: {
		variant: "important",
		heading: "We have had to cancel your session on Thursday 12 November",
		children: (
			<p>
				Sorry for the inconvenience. Please choose a new date. Your software choices have
				been kept.
			</p>
		),
	},
};

export const ErrorSummaryStory: Story = {
	name: "Error summary",
	render: () => (
		<>
			<ErrorSummary
				errors={[
					{ fieldId: "date-day", text: "Enter a date for the session" },
					{ fieldId: "capacity", text: "Capacity must be 1 or more" },
				]}
			/>
			<label htmlFor="date-day">Day</label>
			<input id="date-day" />
			<label htmlFor="capacity">Capacity</label>
			<input id="capacity" />
		</>
	),
};

export const NoteStory: Story = {
	name: "Note",
	render: () => (
		<Note>
			<p>
				<strong>41 cases</strong> are waiting for an invitation. Up to 15 go out at 9am each
				working day.
			</p>
		</Note>
	),
};

export const CheckNote: Story = {
	render: () => (
		<Note variant="check">
			<p>
				<strong>Check before importing.</strong> Leah has another laptop that was seen
				today.
			</p>
		</Note>
	),
};

export const Inset: Story = {
	render: () => (
		<InsetText>
			<p>If the date no longer works for you, rebook onto another date.</p>
		</InsetText>
	),
};

/** Shaded, for a page's read-only notice (mockups: AdminSessionCancelled). */
export const InsetShaded: Story = {
	name: "Inset, shaded",
	render: () => (
		<InsetText shaded>
			<p>
				<strong>This session was cancelled on 9 November 2026 by Ben Green.</strong> It is
				hidden from colleagues and cannot be booked or changed.
			</p>
		</InsetText>
	),
};

export const Warning: Story = {
	render: () => <WarningText>This updates Halo and cannot be undone.</WarningText>,
};

export const PanelStory: Story = {
	name: "Panel",
	render: () => (
		<Panel title="Availability sent">
			<p>We will be in touch to arrange a time.</p>
		</Panel>
	),
};
