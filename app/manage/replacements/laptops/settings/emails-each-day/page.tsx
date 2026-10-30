import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { StatTiles } from "@/components/ui/stat-tiles";
import { Table, TableSecondary } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { requireRole } from "@/lib/auth/guards";
import { londonToday } from "@/lib/clock";
import { formatLongDate, formatShortDay } from "@/lib/dates/format";
import { ACCESS, canAccess } from "@/lib/portal/access";
import { plural } from "@/lib/utils/text";
import {
	emailsEachDay,
	type ForecastDay,
} from "@/services/replacements/laptops/lib/emails/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SETTINGS } from "../definitions";

export const metadata: Metadata = { title: "Emails each day" };

/** Mockups: AdminEmailsDaily. */
export default async function EmailsEachDayPage() {
	const user = await requireRole(ACCESS.laptopsSettings);
	const today = londonToday();
	const { today: sentToday, forecast, sent, queued, perDay } = await emailsEachDay(today);
	const next = forecast[0];
	const busiest = forecast.reduce<ForecastDay | undefined>(
		(top, day) => (!top || day.total > top.total ? day : top),
		undefined,
	);

	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]}>
			<PageHeading caption="Settings · Emails" title="Emails each day" />
			<p>
				How many emails laptop replacements sends. Invitations and reminders go out together
				at 9:00am; the other emails are sent straight away when something happens.
			</p>
			<StatTiles
				columns={3}
				tiles={[
					{
						label: "Today",
						value: String(sentToday.totalSent),
						description: `sent so far${sentToday.failed ? `, ${sentToday.failed} failed` : ""}`,
					},
					{
						label: next ? `${formatLongDate(next.day)} at 9:00am` : "Next working day",
						value: String(next?.total ?? 0),
						description: next ? `scheduled: ${scheduledWords(next)}` : "scheduled",
					},
					{
						label: busiest ? formatLongDate(busiest.day) : "Next 5 working days",
						value: String(busiest?.total ?? 0),
						description: "the busiest of the next 5 working days",
					},
				]}
			/>

			<section aria-labelledby="forecast-heading" className="bcp-section">
				<h2 id="forecast-heading">Scheduled for the next 5 working days</h2>
				<p className="bcp-secondary-text">
					Worked out from the invitation queue, bookings and your reminder settings.
					Emails sent when something happens, such as booking confirmations, are not
					included.
				</p>
				<Table
					caption="Scheduled for the next 5 working days"
					captionHidden
					columns={[
						{ key: "day", header: "Day" },
						{ key: "invitations", header: "Invitations", numeric: true },
						{ key: "booking", header: "Booking reminders", numeric: true },
						{ key: "rebook", header: "Rebook needed", numeric: true },
						{ key: "session", header: "Session reminders", numeric: true },
						{ key: "return", header: "Return reminders", numeric: true },
						{ key: "total", header: "Total", numeric: true },
					]}
					rows={forecast.map((day) => ({
						id: day.day,
						cells: {
							day: formatShortDay(day.day),
							invitations: day.invitations,
							booking: day.bookingReminders,
							rebook: day.rebookReminders,
							session: day.sessionReminders,
							return: day.returnReminders,
							total: <strong>{day.total}</strong>,
						},
					}))}
				/>
				<p className="bcp-secondary-text">
					Invitations only count cases already in the queue ({queued}), at {perDay} a
					working day.
				</p>
			</section>

			<section aria-labelledby="sent-heading" className="bcp-section">
				<h2 id="sent-heading">Sent in the last 5 working days</h2>
				<Table
					caption="Sent in the last 5 working days"
					captionHidden
					columns={[
						{ key: "day", header: "Day" },
						{ key: "invitations", header: "Invitations", numeric: true },
						{ key: "reminders", header: "Reminders", numeric: true },
						{ key: "automatic", header: "Sent when something happened", numeric: true },
						{ key: "failed", header: "Failed", numeric: true },
						{ key: "total", header: "Total sent", numeric: true },
					]}
					rows={sent.map((day) => ({
						id: day.day,
						cells: {
							day: (
								<>
									{formatShortDay(day.day)}
									{day.day === today ? (
										<TableSecondary>so far</TableSecondary>
									) : null}
								</>
							),
							invitations: day.invitations,
							reminders: day.reminders,
							automatic: day.automatic,
							failed: day.failed ? <Tag colour="red">{day.failed}</Tag> : 0,
							total: <strong>{day.totalSent}</strong>,
						},
					}))}
				/>
				{canAccess(user.roles, ACCESS.management) ? (
					<p>
						Each email is also listed in the{" "}
						<Link href={`${SETTINGS}/connection-log?connection=email_webhook`}>
							connection log
						</Link>{" "}
						for 7 days.
					</p>
				) : null}
			</section>
		</LaptopsPage>
	);

	function scheduledWords(day: ForecastDay): string {
		const parts = [
			day.invitations ? plural(day.invitations, "invitation") : "",
			day.bookingReminders ? plural(day.bookingReminders, "booking reminder") : "",
			day.rebookReminders ? plural(day.rebookReminders, "rebook reminder") : "",
			day.sessionReminders ? plural(day.sessionReminders, "session reminder") : "",
			day.returnReminders ? plural(day.returnReminders, "return reminder") : "",
		].filter(Boolean);
		return parts.length ? parts.join(", ") : "nothing";
	}
}
