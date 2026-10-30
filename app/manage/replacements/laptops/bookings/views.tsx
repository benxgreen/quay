import { GroupHeading } from "@/components/patterns/group-heading";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { PreparedTag } from "@/components/service/replacements/status-tag";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Calendar, type CalendarDay, CalendarEntry } from "@/components/ui/calendar";
import { DateNavigation } from "@/components/ui/date-navigation";
import { Link } from "@/components/ui/link";
import { PrintButton } from "@/components/ui/print-button";
import { Table, TableSecondary } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { formatLongDate, formatMonth, formatShortDay, formatTime } from "@/lib/dates/format";
import { addDays, type IsoDate, isoWeekday, WORKING_WEEKDAYS } from "@/lib/dates/working-days";
import { capitalise, listWords, plural } from "@/lib/utils/text";
import {
	addMonths,
	allBookings,
	type BookingsFilters,
	type DashboardBooking,
	type DashboardSession,
	type DayGroup,
	dayGroups,
	filtersPeople,
	incompleteBookings,
	monthSessions,
	type WeekItem,
	weekDays,
	weekStart,
} from "@/services/replacements/laptops/lib/bookings";
import { boxHostnames } from "@/services/replacements/laptops/lib/stock";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { bookingsHref } from "./links";

type ViewProps = { filters: BookingsFilters; today: IsoDate };

const CASES = LAPTOPS_SECTIONS.cases.href;
const SESSIONS = LAPTOPS_SECTIONS.sessions.href;

function caseHref(reference: string): string {
	return `${CASES}/${reference}`;
}

/** The weekday before or after, skipping weekends. */
function nextWeekday(day: IsoDate, step: 1 | -1): IsoDate {
	let next = addDays(day, step);
	while (isoWeekday(next) > 5) next = addDays(next, step);
	return next;
}

function PrintThisView() {
	return (
		<p>
			<PrintButton>Print this view</PrintButton>
		</p>
	);
}

function sessionMeta(session: DashboardSession): string {
	return `${session.location} · ${session.status === "cancelled" ? "Cancelled" : `${session.booked} of ${session.capacity} booked`}`;
}

function SessionStatus({ session }: { session: DashboardSession }) {
	if (session.status === "cancelled") return <Tag colour="grey">Cancelled</Tag>;
	if (session.status === "full") return <Tag colour="red">Full</Tag>;
	return null;
}

/** Mockups: AdminDashboard. Each session and custom appointment on one day, with who is coming. */
export async function DayView({ filters, today, userId }: ViewProps & { userId: string }) {
	const groups = await dayGroups(filters);
	const hasBoxes = groups.some((group) =>
		group.kind === "session"
			? group.bookings.some((booking) => booking.boxNumber)
			: group.booking.boxNumber,
	);
	const hostnames = hasBoxes
		? await boxHostnames({ kind: "user", label: "Bookings dashboard", actorUserId: userId })
		: new Map<string, string>();

	return (
		<>
			<DateNavigation
				heading={formatLongDate(filters.date, { year: true })}
				label="Change day"
				previous={{
					href: bookingsHref(filters, today, { date: nextWeekday(filters.date, -1) }),
					text: "Previous day",
				}}
				current={{ href: bookingsHref(filters, today, { date: today }), text: "Today" }}
				next={{
					href: bookingsHref(filters, today, { date: nextWeekday(filters.date, 1) }),
					text: "Next day",
				}}
			/>
			<p>{daySummary(groups)}</p>
			{hostnames === null ? (
				<p className="bcp-secondary-text">
					Hostnames are not shown because Halo could not be reached.
				</p>
			) : null}
			{groups.length ? <PrintThisView /> : null}
			{groups.map((group) =>
				group.kind === "session" ? (
					<section key={`session-${group.session.id}`}>
						<GroupHeading
							before={<TypeTag type={group.session.type} />}
							title={formatTime(group.session.time)}
							meta={sessionMeta(group.session)}
							after={<SessionStatus session={group.session} />}
							action={
								<Link href={`${SESSIONS}/${group.session.id}`}>
									View session
									<span className="sr-only">
										{" "}
										at {formatTime(group.session.time)}
									</span>
								</Link>
							}
						/>
						<PeopleTable
							caption={`People booked at ${formatTime(group.session.time)}`}
							bookings={group.bookings}
							hostnames={hostnames}
							empty={
								group.session.status === "cancelled"
									? "This session was cancelled."
									: "Nobody is booked yet."
							}
						/>
					</section>
				) : (
					<section key={`custom-${group.booking.bookingId}`}>
						<GroupHeading
							before={<TypeTag type={group.booking.type} />}
							title={formatTime(group.booking.time)}
							meta={`Custom appointment · ${group.booking.location}`}
							action={
								<Link href={caseHref(group.booking.reference)}>
									View case
									<span className="sr-only"> for {group.booking.name}</span>
								</Link>
							}
						/>
						<PeopleTable
							caption={`Custom appointment at ${formatTime(group.booking.time)}`}
							bookings={[group.booking]}
							hostnames={hostnames}
						/>
					</section>
				),
			)}
		</>
	);
}

function daySummary(groups: DayGroup[]): string {
	const live = groups.flatMap((group) =>
		group.kind === "session" && group.session.status !== "cancelled" ? [group.session] : [],
	);
	const custom = groups.filter((group) => group.kind === "custom").length;
	const cancelled = groups.length - live.length - custom;
	const parts: string[] = [];
	for (const type of ["collection", "session"] as const) {
		const sessions = live.filter((session) => session.type === type);
		if (!sessions.length) continue;
		const booked = sessions.reduce((sum, session) => sum + session.booked, 0);
		const capacity = sessions.reduce((sum, session) => sum + session.capacity, 0);
		parts.push(
			`${plural(sessions.length, type)} with ${booked} of ${capacity} ${type === "collection" ? "places " : ""}booked`,
		);
	}
	if (custom) parts.push(plural(custom, "custom appointment"));
	if (!parts.length && !cancelled) return "No sessions or custom appointments.";
	const sentence = parts.length ? `${capitalise(listWords(parts))}.` : "";
	return cancelled ? `${sentence} ${plural(cancelled, "cancelled session")}.`.trim() : sentence;
}

const PAGE_SIZE = 20;

function PeopleTable({
	caption,
	bookings,
	hostnames,
	empty,
}: {
	caption: string;
	bookings: DashboardBooking[];
	hostnames: Map<string, string> | null;
	empty?: string;
}) {
	const table = {
		caption,
		captionHidden: true,
		empty,
		columns: [
			{ key: "name", header: "Name" },
			{ key: "case", header: "Case" },
			{ key: "box", header: "Box number" },
			{ key: "hostname", header: "Hostname" },
			{ key: "software", header: "Software requested" },
			{ key: "device", header: "Device" },
			{ key: "prepared", header: "Software" },
		],
		rows: bookings.map((booking) => ({
			id: booking.bookingId,
			cells: {
				name: booking.name,
				case: <Link href={caseHref(booking.reference)}>{booking.reference}</Link>,
				box: booking.boxNumber ?? "Not allocated",
				hostname: (booking.boxNumber && hostnames?.get(booking.boxNumber)) || "–",
				software: booking.software.length ? booking.software.join(", ") : "None",
				device: <PreparedTag prepared={booking.devicePrepared} />,
				prepared: booking.software.length ? (
					<PreparedTag prepared={booking.softwarePrepared} />
				) : (
					"–"
				),
			},
		})),
	};
	// Most sessions fit on one screen; "Show more" only for a big one.
	return bookings.length > PAGE_SIZE ? (
		<ShowMoreTable {...table} noun="people" pageSize={PAGE_SIZE} />
	) : (
		<Table {...table} />
	);
}

/** "9 to 13 November 2026", or across months "30 November to 4 December 2026". */
function weekHeading(monday: IsoDate, friday: IsoDate): string {
	const end = formatLongDate(friday, { year: true }).replace(/^\S+ /, "");
	if (monday.slice(0, 7) === friday.slice(0, 7)) return `${Number(monday.slice(8))} to ${end}`;
	const startWords = formatLongDate(monday, { year: true }).replace(/^\S+ /, "");
	const start =
		monday.slice(0, 4) === friday.slice(0, 4) ? startWords.replace(/ \d{4}$/, "") : startWords;
	return `${start} to ${end}`;
}

/** Mockups: AdminDashboardWeek. Monday to Friday, each day's sessions and custom appointments. */
export async function WeekView({ filters, today }: ViewProps) {
	const days = await weekDays(filters);
	const monday = weekStart(filters.date);
	const items = days.flatMap((day) => day.items);
	const sessions = items.flatMap((item) =>
		item.kind === "session" && item.session.status !== "cancelled" ? [item.session] : [],
	);
	const custom = items.filter((item) => item.kind === "custom").length;
	const collections = sessions.filter((session) => session.type === "collection").length;
	const booked = sessions.reduce((sum, session) => sum + session.booked, 0);
	const capacity = sessions.reduce((sum, session) => sum + session.capacity, 0);

	const summary = sessions.length
		? `${plural(sessions.length, "session")} this week: ${listWords(
				[
					collections ? plural(collections, "collection") : "",
					sessions.length - collections
						? plural(sessions.length - collections, "session")
						: "",
				].filter(Boolean),
			)}, with ${booked} of ${capacity} places booked.${custom ? ` Plus ${plural(custom, "custom appointment")}.` : ""}`
		: custom
			? `No sessions this week. ${capitalise(plural(custom, "custom appointment"))}.`
			: "No sessions or custom appointments this week.";

	return (
		<>
			<DateNavigation
				heading={weekHeading(monday, addDays(monday, 4))}
				label="Change week"
				previous={{
					href: bookingsHref(filters, today, { date: addDays(monday, -7) }),
					text: "Previous week",
				}}
				current={{ href: bookingsHref(filters, today, { date: today }), text: "This week" }}
				next={{
					href: bookingsHref(filters, today, { date: addDays(monday, 7) }),
					text: "Next week",
				}}
			/>
			<p>{summary}</p>
			{items.length ? <PrintThisView /> : null}
			{days.map((day) => {
				const dayCancelled = day.items.filter(
					(item) => item.kind === "session" && item.session.status === "cancelled",
				).length;
				const dayCustom = day.items.filter((item) => item.kind === "custom").length;
				const daySessions = day.items.length - dayCustom - dayCancelled;
				const meta =
					listWords(
						[
							daySessions ? plural(daySessions, "session") : "",
							dayCancelled ? plural(dayCancelled, "cancelled session") : "",
							dayCustom ? plural(dayCustom, "custom appointment") : "",
						].filter(Boolean),
					) || "No sessions";
				const title = formatLongDate(day.date);
				return (
					<section key={day.date}>
						<GroupHeading
							title={
								<Link
									href={bookingsHref(filters, today, {
										view: "day",
										date: day.date,
									})}
								>
									{title}
								</Link>
							}
							meta={meta}
						/>
						{day.items.length ? (
							<Table
								caption={`Sessions on ${title}`}
								captionHidden
								columns={[
									{ key: "time", header: "Time" },
									{ key: "type", header: "Type" },
									{ key: "location", header: "Location" },
									{ key: "booked", header: "Booked" },
									{ key: "prepared", header: "Devices prepared" },
									{
										key: "action",
										header: <span className="sr-only">Actions</span>,
									},
								]}
								rows={day.items.map((item) => weekRow(item, title))}
							/>
						) : (
							<p>No sessions.</p>
						)}
					</section>
				);
			})}
		</>
	);
}

function weekRow(item: WeekItem, dayTitle: string) {
	if (item.kind === "custom") {
		const { booking } = item;
		return {
			id: `custom-${booking.bookingId}`,
			cells: {
				time: formatTime(booking.time),
				type: (
					<>
						<TypeTag type={booking.type} />
						<TableSecondary>Custom appointment</TableSecondary>
					</>
				),
				location: booking.location,
				booked: booking.name,
				prepared: `${item.devicesPrepared} of 1`,
				action: (
					<Link href={caseHref(booking.reference)}>
						Case {booking.reference}
						<span className="sr-only"> for {booking.name}</span>
					</Link>
				),
			},
		};
	}
	const { session } = item;
	return {
		id: `session-${session.id}`,
		cells: {
			time: formatTime(session.time),
			type: <TypeTag type={session.type} />,
			location: session.location,
			booked:
				session.status === "cancelled" ? (
					<Tag colour="grey">Cancelled</Tag>
				) : (
					<>
						{session.booked} of {session.capacity} <SessionStatus session={session} />
					</>
				),
			prepared:
				session.status === "cancelled" ? "–" : `${item.devicesPrepared} of ${item.booked}`,
			action: (
				<Link href={`${SESSIONS}/${session.id}`}>
					View attendees
					<span className="sr-only">
						{" "}
						{dayTitle} {formatTime(session.time)}
					</span>
				</Link>
			),
		},
	};
}

const WEEKDAYS = WORKING_WEEKDAYS.map((long) => ({ short: long.slice(0, 3), long }));

/** Mockups: AdminDashboardMonth. A calendar of the month's sessions, each linking to its day. */
export async function MonthView({ filters, today }: ViewProps) {
	const sessions = await monthSessions(filters);
	const first = `${filters.date.slice(0, 7)}-01`;
	const month = first.slice(0, 7);
	const live = sessions.filter((session) => session.status !== "cancelled");
	const collections = sessions.filter((session) => session.type === "collection").length;
	const cancelled = sessions.length - live.length;

	const summary = sessions.length
		? `${plural(sessions.length, "session")} this month: ${listWords(
				[
					collections ? plural(collections, "collection") : "",
					sessions.length - collections
						? plural(sessions.length - collections, "session")
						: "",
				].filter(Boolean),
			)}${cancelled ? ` (${cancelled} cancelled)` : ""}. Select a session to see who is booked.`
		: "No sessions this month.";

	// Monday to Friday weeks covering the month.
	const weeks: CalendarDay[][] = [];
	const last = addDays(addMonths(first, 1), -1);
	// A month starting on a weekend has no weekdays in its first week.
	for (
		let monday = weekStart(
			isoWeekday(first) > 5 ? addDays(first, 8 - isoWeekday(first)) : first,
		);
		monday <= last;
		monday = addDays(monday, 7)
	) {
		weeks.push(
			[0, 1, 2, 3, 4].map((offset) => {
				const day = addDays(monday, offset);
				return {
					key: day,
					number: String(Number(day.slice(8))),
					label: formatLongDate(day),
					inPeriod: day.slice(0, 7) === month,
					past: day < today,
					children: sessions
						.filter((session) => session.date === day)
						.map((session) => (
							<CalendarEntry
								key={session.id}
								href={bookingsHref(filters, today, { view: "day", date: day })}
								title={`${formatTime(session.time)} ${session.type === "collection" ? "Collection" : "Session"}`}
								detail={
									session.status === "cancelled"
										? "Cancelled"
										: `${session.booked} of ${session.capacity}`
								}
								colour={session.type === "collection" ? "light-blue" : "purple"}
								struck={session.status === "cancelled"}
							/>
						)),
				};
			}),
		);
	}

	return (
		<>
			<DateNavigation
				heading={formatMonth(month)}
				label="Change month"
				previous={{
					href: bookingsHref(filters, today, { date: addMonths(first, -1) }),
					text: "Previous month",
				}}
				current={{
					href: bookingsHref(filters, today, { date: today }),
					text: "This month",
				}}
				next={{
					href: bookingsHref(filters, today, { date: addMonths(first, 1) }),
					text: "Next month",
				}}
			/>
			<p>{summary}</p>
			<PrintThisView />
			<Calendar
				caption={`Sessions in ${formatMonth(month)}`}
				weekdays={WEEKDAYS}
				weeks={weeks}
			/>
		</>
	);
}

/** Mockups: AdminBookingsAll. Every upcoming booking, earliest first. */
export async function AllView({ filters, today }: ViewProps) {
	const bookings = await allBookings(filters, today);
	const words = filters.past ? "bookings" : "upcoming bookings";

	return (
		<>
			<p>
				{bookings.length === 1
					? `1 ${words.replace("bookings", "booking")}`
					: `${bookings.length} ${words}`}
				, earliest first. Names open the case in a new tab.
			</p>
			{bookings.length ? <PrintThisView /> : null}
			<ShowMoreTable
				caption="All bookings"
				captionHidden
				noun="bookings"
				empty="No bookings match. Try changing the search or filters."
				columns={[
					{ key: "when", header: "Date and time" },
					{ key: "person", header: "Person" },
					{ key: "type", header: "Type" },
					{ key: "box", header: "Box number" },
					{ key: "software", header: "Software requested" },
					{ key: "device", header: "Device" },
					{ key: "prepared", header: "Software" },
				]}
				rows={bookings.map((booking) => ({
					id: booking.bookingId,
					cells: {
						when: `${formatShortDay(booking.date)}, ${formatTime(booking.time)}`,
						person: (
							<>
								<Link href={caseHref(booking.reference)} newTab>
									{booking.name}
								</Link>
								<TableSecondary>{booking.reference}</TableSecondary>
								{booking.flagReason ? (
									<TableSecondary>Flagged: {booking.flagReason}</TableSecondary>
								) : null}
								{booking.sessionId ? null : (
									<TableSecondary>Custom appointment</TableSecondary>
								)}
							</>
						),
						type: <TypeTag type={booking.type} />,
						box: booking.boxNumber ?? "–",
						software: booking.software.length ? (
							<ul className="bcp-list bcp-list--plain">
								{booking.software.map((name) => (
									<li key={name}>{name}</li>
								))}
							</ul>
						) : (
							<TableSecondary>None requested</TableSecondary>
						),
						device: <PreparedTag prepared={booking.devicePrepared} />,
						prepared: booking.software.length ? (
							<PreparedTag prepared={booking.softwarePrepared} />
						) : (
							"–"
						),
					},
				}))}
			/>
		</>
	);
}

/**
 * Incomplete bookings: every booking from a past day still marked Booked,
 * oldest first. The same bookings as the review modal, as a list that
 * can be searched, filtered and printed.
 */
export async function IncompleteView({ filters, today }: ViewProps) {
	const bookings = await incompleteBookings(filters, today);

	return (
		<>
			<p>
				{bookings.length === 1
					? "1 booking from a past day has"
					: `${bookings.length} bookings from past days have`}{" "}
				not been completed, oldest first. Open each case to complete the replacement, or
				record that the person did not attend.
			</p>
			{bookings.length ? <PrintThisView /> : null}
			<ShowMoreTable
				caption="Incomplete bookings"
				captionHidden
				noun="bookings"
				empty={
					filtersPeople(filters) || filters.type || filters.kind
						? "No incomplete bookings match. Try changing the search or filters."
						: "Every booking from a past day has been completed or marked did not attend."
				}
				columns={[
					{ key: "when", header: "Date and time" },
					{ key: "person", header: "Person" },
					{ key: "type", header: "Type" },
					{ key: "box", header: "Box number" },
					{ key: "device", header: "Device" },
					{ key: "prepared", header: "Software" },
				]}
				rows={bookings.map((booking) => ({
					id: booking.bookingId,
					cells: {
						when: `${formatShortDay(booking.date, { year: true })}, ${formatTime(booking.time)}`,
						person: (
							<>
								<Link href={caseHref(booking.reference)} newTab>
									{booking.name}
								</Link>
								<TableSecondary>{booking.reference}</TableSecondary>
								{booking.sessionId ? null : (
									<TableSecondary>Custom appointment</TableSecondary>
								)}
							</>
						),
						type: <TypeTag type={booking.type} />,
						box: booking.boxNumber ?? "Not allocated",
						device: <PreparedTag prepared={booking.devicePrepared} />,
						prepared: booking.software.length ? (
							<PreparedTag prepared={booking.softwarePrepared} />
						) : (
							"–"
						),
					},
				}))}
			/>
		</>
	);
}
