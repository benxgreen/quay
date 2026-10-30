import type { Metadata } from "next";
import { FilterGrid, FilterOptions, FilterPanel } from "@/components/patterns/filter-panel";
import { BookingReview } from "@/components/service/replacements/booking-review";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Checkbox } from "@/components/ui/checkboxes";
import { PageHeading } from "@/components/ui/page-heading";
import { Select } from "@/components/ui/select";
import { requireRole } from "@/lib/auth/guards";
import { londonToday } from "@/lib/clock";
import { formatShortDay, formatTime } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import {
	bookingsToReview,
	filtersPeople,
	parseBookingsFilters,
} from "@/services/replacements/laptops/lib/bookings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { bookingsHref } from "./links";
import { AllView, DayView, IncompleteView, MonthView, WeekView } from "./views";

export const metadata: Metadata = { title: "Bookings" };

type BookingsPageProps = {
	searchParams: Promise<Record<string, string | undefined>>;
};

/** Mockups: AdminDashboard, AdminDashboardWeek, AdminDashboardMonth, AdminBookingsAll. */
export default async function BookingsPage({ searchParams }: BookingsPageProps) {
	const user = await requireRole(ACCESS.laptops);
	const today = londonToday();
	const filters = parseBookingsFilters(await searchParams, today);
	const review = await bookingsToReview(today);
	const filtered =
		filtersPeople(filters) || Boolean(filters.type || filters.kind || filters.past);

	return (
		<LaptopsPage section="bookings">
			<PageHeading title="Bookings" />
			<FilterPanel
				search={{
					label: "Search bookings",
					hint: "Name, case reference or software",
					defaultValue: filters.q,
				}}
				clearHref={bookingsHref(
					parseBookingsFilters({ view: filters.view, date: filters.date }, today),
					today,
				)}
				defaultOpen={filtered}
				hiddenFields={filters.date !== today ? { date: filters.date } : undefined}
			>
				<FilterGrid>
					<Select
						id="view"
						name="view"
						label="View"
						defaultValue={filters.view}
						options={[
							{ value: "day", label: "Day" },
							{ value: "week", label: "Week" },
							{ value: "month", label: "Month" },
							{ value: "all", label: "All bookings" },
							{ value: "incomplete", label: "Incomplete bookings" },
						]}
					/>
					<Select
						id="type"
						name="type"
						label="Type"
						defaultValue={filters.type}
						options={[
							{ value: "", label: "All types" },
							{ value: "collection", label: "Collection" },
							{ value: "session", label: "Session" },
						]}
					/>
					<Select
						id="kind"
						name="kind"
						label="Booking"
						defaultValue={filters.kind}
						options={[
							{ value: "", label: "All bookings" },
							{ value: "published", label: "Published sessions" },
							{ value: "custom", label: "Custom appointments" },
						]}
					/>
				</FilterGrid>
				<FilterOptions>
					<Checkbox
						id="device"
						name="device"
						value="1"
						label="Device unprepared"
						small
						defaultChecked={filters.deviceUnprepared}
					/>
					<Checkbox
						id="software"
						name="software"
						value="1"
						label="Software not prepared"
						small
						defaultChecked={filters.softwareUnprepared}
					/>
					{filters.view === "all" ? (
						<Checkbox
							id="past"
							name="past"
							value="1"
							label="Include past bookings"
							small
							defaultChecked={filters.past}
						/>
					) : null}
				</FilterOptions>
			</FilterPanel>

			<BookingReview
				listHref={bookingsHref(parseBookingsFilters({ view: "incomplete" }, today), today)}
				items={review.map((booking) => ({
					bookingId: booking.bookingId,
					reference: booking.reference,
					name: booking.name,
					detail: [
						`${formatShortDay(booking.date)}, ${formatTime(booking.time)}`,
						booking.type === "collection" ? "Collection" : "Session",
						booking.custom
							? "Custom appointment"
							: booking.boxNumber
								? `Box ${booking.boxNumber}`
								: "No device allocated",
					].join(" · "),
					href: `${LAPTOPS_SECTIONS.cases.href}/${booking.reference}`,
				}))}
			/>

			{filters.view === "week" ? (
				<WeekView filters={filters} today={today} />
			) : filters.view === "month" ? (
				<MonthView filters={filters} today={today} />
			) : filters.view === "incomplete" ? (
				<IncompleteView filters={filters} today={today} />
			) : filters.view === "all" ? (
				<AllView filters={filters} today={today} />
			) : (
				<DayView filters={filters} today={today} userId={user.id} />
			)}
		</LaptopsPage>
	);
}
