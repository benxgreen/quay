import type { Metadata } from "next";
import type { ReactNode } from "react";
import { InlineAddForm } from "@/components/patterns/settings-form";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { TypeTag } from "@/components/service/replacements/type-tag";
import { Button } from "@/components/ui/button";
import { InsetText } from "@/components/ui/inset-text";
import { Link, LinkButton } from "@/components/ui/link";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { Sidebar } from "@/components/ui/sidebar";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { Table } from "@/components/ui/table";
import { TagGroup } from "@/components/ui/tag";
import { requireRole } from "@/lib/auth/guards";
import { londonToday } from "@/lib/clock";
import { formatFullDate, formatLongDate, formatTime, formatUpdatedAt } from "@/lib/dates/format";
import { ACCESS, canAccess } from "@/lib/portal/access";
import { listConnections } from "@/lib/portal/connections";
import { plural } from "@/lib/utils/text";
import { LAPTOP_EMAILS } from "@/services/replacements/laptops/lib/emails";
import { emailsEachDay, getEmailSender } from "@/services/replacements/laptops/lib/emails/settings";
import {
	CHECKLISTS,
	type ChecklistItem,
	type ChecklistName,
	getServiceSettings,
	listChecklist,
	listContent,
	listDefaults,
	listFaqs,
	listSoftware,
	type ServiceSettings,
	WEEKDAYS,
} from "@/services/replacements/laptops/lib/settings";
import { addCheckAction, addSoftwareAction, moveItemAction } from "./actions";
import { SAVED_MESSAGES, SETTINGS } from "./definitions";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
	{ id: "software", text: "Software list" },
	{ id: "page", text: "Portal content" },
	{ id: "faqs", text: "Frequently asked questions" },
	{ id: "emails", text: "Emails" },
	{ id: "defaults", text: "Session defaults" },
	{ id: "invites", text: "Invitations and reminders" },
	{ id: "prep", text: "Device preparation checks" },
	{ id: "decom", text: "Decommission checklist" },
	{ id: "jobs", text: "Scheduled jobs" },
];

/** Only Administrators see Connections. */
const CONNECTIONS_SECTION = { id: "connections", text: "Connections" };

/** Mockups: AdminSettings. */
export default async function SettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ saved?: string }>;
}) {
	const user = await requireRole(ACCESS.laptopsSettings);
	const isAdministrator = canAccess(user.roles, ACCESS.management);
	const { saved } = await searchParams;
	const today = londonToday();
	const [software, content, faqs, defaults, settings, prep, decom, sender, counts, connections] =
		await Promise.all([
			listSoftware(),
			listContent(),
			listFaqs(),
			listDefaults(),
			getServiceSettings(),
			listChecklist("device_preparation"),
			listChecklist("decommission"),
			getEmailSender(),
			emailsEachDay(today),
			isAdministrator ? listConnections() : Promise.resolve([]),
		]);
	const message = saved ? SAVED_MESSAGES[saved] : undefined;

	return (
		<LaptopsPage
			section="settings"
			sidebarPosition="start"
			sidebarHeader={
				<>
					{message ? <NotificationBanner variant="success" heading={message} /> : null}
					<PageHeading title="Settings" />
				</>
			}
			sidebar={
				<Sidebar label="On this page">
					<ul className="bcp-list--plain bcp-list--spaced">
						{(isAdministrator ? [...SECTIONS, CONNECTIONS_SECTION] : SECTIONS).map(
							(section) => (
								<li key={section.id}>
									<Link href={`#${section.id}`}>{section.text}</Link>
								</li>
							),
						)}
					</ul>
				</Sidebar>
			}
		>
			<Section id="software" title="Software list">
				<p className="bcp-secondary-text">
					Shown as checkboxes when colleagues book, with the hint underneath, and on the
					case page for engineers. Colleagues can also type in software that is not
					listed. Always sorted alphabetically. Changes do not affect existing bookings.
				</p>
				<Table
					caption="Software list"
					captionHidden
					empty="No software on the list."
					columns={[
						{ key: "name", header: "Name" },
						{ key: "hint", header: "Hint shown to colleagues" },
						{ key: "actions", header: <span className="sr-only">Actions</span> },
					]}
					rows={software.map((item) => ({
						id: item.id,
						cells: {
							name: item.name,
							hint: <span className="bcp-secondary-text">{item.hint ?? "–"}</span>,
							actions: (
								<span className="bcp-table-actions">
									<Link href={`${SETTINGS}/software/${item.id}`}>
										Edit<span className="sr-only"> {item.name}</span>
									</Link>
									<Link href={`${SETTINGS}/remove/software/${item.id}`}>
										Remove<span className="sr-only"> {item.name}</span>
									</Link>
								</span>
							),
						},
					}))}
				/>
				<InlineAddForm
					action={addSoftwareAction}
					fields={[
						{ name: "name", label: "Add software" },
						{ name: "hint", label: "Hint (optional)", width: "30" },
					]}
				/>
			</Section>

			<Section id="page" title="Portal content">
				<p className="bcp-secondary-text">
					Shown on the colleague's laptop replacement page, under their booking and
					software. Written in Markdown, one version for each type.
				</p>
				<Table
					caption="Portal content"
					captionHidden
					columns={[
						{ key: "type", header: "Type" },
						{ key: "updated", header: "Last updated" },
						{ key: "actions", header: <span className="sr-only">Actions</span> },
					]}
					rows={(["session", "collection"] as const).map((type) => {
						const item = content.find((row) => row.type === type);
						const word = type === "session" ? "Session" : "Collection";
						return {
							id: type,
							cells: {
								type: word,
								updated: item?.updatedAt
									? `${formatFullDate(item.updatedAt)}${item.updatedBy ? ` by ${item.updatedBy}` : ""}`
									: "Not changed since setup",
								actions: (
									<span className="bcp-table-actions">
										<Link href={`${SETTINGS}/content/${type}`}>
											Edit
											<span className="sr-only"> {word} page content</span>
										</Link>
									</span>
								),
							},
						};
					})}
				/>
			</Section>

			<Section id="faqs" title="Frequently asked questions">
				<p className="bcp-secondary-text">
					Shown at the bottom of the colleague's page as expandable questions. Choose
					which types each question shows for. Questions show in this order.
				</p>
				<Table
					caption="Frequently asked questions"
					captionHidden
					empty="No questions yet."
					columns={[
						{ key: "question", header: "Question" },
						{ key: "shown", header: "Shown for" },
						{ key: "actions", header: <span className="sr-only">Actions</span> },
					]}
					rows={faqs.map((faq, index) => ({
						id: faq.id,
						cells: {
							question: faq.question,
							shown: (
								<TagGroup>
									{faq.shownFor.map((type) => (
										<TypeTag key={type} type={type} />
									))}
								</TagGroup>
							),
							actions: (
								<RowActions
									kind="faq"
									id={faq.id}
									name={faq.question}
									first={index === 0}
									last={index === faqs.length - 1}
									editHref={`${SETTINGS}/faqs/${faq.id}`}
								/>
							),
						},
					}))}
				/>
				<Button variant="secondary" href={`${SETTINGS}/faqs/new`}>
					Add a question
				</Button>
			</Section>

			<Section id="emails" title="Emails">
				<p className="bcp-secondary-text">
					The wording of each email sent to colleagues. Sent through Power Automate; the
					portal fills in the person's details.
				</p>
				<InsetText>
					<p>
						<strong>
							{counts.today.totalSent}{" "}
							{counts.today.totalSent === 1 ? "email" : "emails"} sent today
						</strong>
						{counts.today.failed ? ` (${counts.today.failed} failed)` : ""} and{" "}
						{counts.forecast[0]?.total ?? 0} scheduled for{" "}
						{counts.forecast[0]
							? formatLongDate(counts.forecast[0].day)
							: "the next working day"}{" "}
						at 9:00am.{" "}
						<Link href={`${SETTINGS}/emails-each-day`}>See emails each day</Link>
					</p>
				</InsetText>
				<SummaryList
					rows={[
						{
							key: "Team name",
							value: (
								<>
									{sender.teamName}
									<SummaryListSecondary>
										Shown as the sender name and used in emails as{" "}
										{"{team_name}"}
									</SummaryListSecondary>
								</>
							),
							actions: [
								{
									href: `${SETTINGS}/sender/team`,
									visuallyHiddenText: "team name",
								},
							],
						},
						{
							key: "Sent from",
							value: (
								<>
									{sender.sentFrom}
									<SummaryListSecondary>
										The mailbox laptop replacement emails are sent from
									</SummaryListSecondary>
								</>
							),
							actions: [
								{
									href: `${SETTINGS}/sender/from`,
									visuallyHiddenText: "sent from email address",
								},
							],
						},
						{
							key: "Template",
							value: isAdministrator ? (
								<Link href="/manage/portal-settings/email-template">
									Portal email template
								</Link>
							) : (
								"Portal email template, changed by Administrators in Portal settings"
							),
						},
					]}
				/>
				<Table
					caption="Emails"
					captionHidden
					columns={[
						{ key: "email", header: "Email" },
						{ key: "when", header: "When it is sent" },
						{ key: "actions", header: <span className="sr-only">Actions</span> },
					]}
					rows={LAPTOP_EMAILS.map((email) => ({
						id: email.key,
						cells: {
							email: email.name,
							when: <span className="bcp-secondary-text">{email.sentWhen}</span>,
							actions: (
								<span className="bcp-table-actions">
									<Link href={`${SETTINGS}/emails/${email.key}`}>
										Edit<span className="sr-only"> {email.name} email</span>
									</Link>
								</span>
							),
						},
					}))}
				/>
			</Section>

			<Section id="defaults" title="Session defaults">
				<p className="bcp-secondary-text">
					Filled in when you add a session of that type. You can change them on each
					session.
				</p>
				<Table
					caption="Session defaults"
					captionHidden
					columns={[
						{ key: "type", header: "Type" },
						{ key: "time", header: "Start time" },
						{ key: "capacity", header: "Capacity", numeric: true },
						{ key: "location", header: "Location" },
						{ key: "actions", header: <span className="sr-only">Actions</span> },
					]}
					rows={defaults.map((item) => {
						const word = item.type === "session" ? "Session" : "Collection";
						return {
							id: item.type,
							cells: {
								type: word,
								time: formatTime(item.time),
								capacity: item.capacity,
								location: item.location,
								actions: (
									<span className="bcp-table-actions">
										<Link href={`${SETTINGS}/defaults/${item.type}`}>
											Change<span className="sr-only"> {word} defaults</span>
										</Link>
									</span>
								),
							},
						};
					})}
				/>
			</Section>

			<Section id="invites" title="Invitations and reminders">
				<p className="bcp-secondary-text">
					{isAdministrator
						? "Only Administrator users can change these."
						: "Only Administrator users can change these. Ask an Administrator if one needs changing."}
				</p>
				<SummaryList rows={reminderRows(settings, isAdministrator)} />
			</Section>

			{(["device_preparation", "decommission"] as const).map((list) => (
				<ChecklistSection
					key={list}
					list={list}
					items={list === "decommission" ? decom : prep}
				/>
			))}

			<Section id="jobs" title="Scheduled jobs">
				<p>
					<Link href={`${SETTINGS}/jobs`}>Scheduled jobs</Link>
				</p>
				<p className="bcp-secondary-text">
					The 9:00am invitation and reminder jobs, when each last ran, and the job log.
				</p>
			</Section>

			{isAdministrator ? (
				<Section id="connections" title="Connections">
					<p className="bcp-secondary-text">
						Only shown to Administrator users. Only the start of each link is shown;
						passwords and keys are kept on the server, not here.
					</p>
					<SummaryList
						rows={connections.map((connection) => ({
							key: connection.label,
							value: (
								<>
									<span className="bcp-break-all">
										{connection.urlStart ?? "Not set"}
									</span>
									<SummaryListSecondary>
										{connection.lastUsedAt
											? `Last used ${formatUpdatedAt(connection.lastUsedAt)}`
											: "Not used in the last 7 days"}
									</SummaryListSecondary>
								</>
							),
							actions: [
								{
									href: `${SETTINGS}/connections/${connection.key}`,
									visuallyHiddenText: connection.label,
								},
							],
						}))}
					/>
					<p>
						<Link href={`${SETTINGS}/connection-log`}>Connection log</Link>
					</p>
					<p className="bcp-secondary-text">
						Every call to Halo and Power Automate in the last 7 days, with what
						triggered it and the case it was for.
					</p>
				</Section>
			) : null}
		</LaptopsPage>
	);
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
	return (
		<section id={id} aria-labelledby={`${id}-heading`} className="bcp-section">
			<h2 id={`${id}-heading`}>{title}</h2>
			{children}
		</section>
	);
}

/** Move up, Move down, Edit and Remove for a row in an ordered list. */
function RowActions({
	kind,
	id,
	name,
	first,
	last,
	editHref,
}: {
	kind: "faq" | ChecklistName;
	id: string;
	name: string;
	first: boolean;
	last: boolean;
	editHref: string;
}) {
	return (
		<span className="bcp-table-actions">
			{first ? null : (
				<form action={moveItemAction.bind(null, kind, id, "up")}>
					<LinkButton>
						Move up<span className="sr-only"> {name}</span>
					</LinkButton>
				</form>
			)}
			{last ? null : (
				<form action={moveItemAction.bind(null, kind, id, "down")}>
					<LinkButton>
						Move down<span className="sr-only"> {name}</span>
					</LinkButton>
				</form>
			)}
			<Link href={editHref}>
				Edit<span className="sr-only"> {name}</span>
			</Link>
			<Link href={`${SETTINGS}/remove/${kind}/${id}`}>
				Remove<span className="sr-only"> {name}</span>
			</Link>
		</span>
	);
}

function weekdayName(day: number): string {
	return WEEKDAYS[day - 1] ?? "Monday";
}

function reminderRows(settings: ServiceSettings, canChange: boolean) {
	const change = (slug: string, what: string) =>
		canChange
			? [{ href: `${SETTINGS}/invitations/${slug}`, visuallyHiddenText: what }]
			: undefined;
	return [
		{
			key: "Invitations per working day",
			value: String(settings.invitationsPerWorkingDay),
			actions: change("invitations", "invitations per working day"),
		},
		{
			key: "First reminder",
			value: `${plural(settings.firstReminderAfterDays, "day")} after invitation, then weekly on ${weekdayName(settings.reminderWeekday)}s until the person books`,
			actions: change("reminders", "first reminder"),
		},
		{
			key: "Flag case after",
			value: plural(settings.flagAfterReminders, "reminder"),
			actions: change("flag", "flag case after"),
		},
		{
			key: "Old device return reminders",
			value: settings.returnRemindersEnabled
				? `Weekly on ${weekdayName(settings.returnReminderWeekday)}s after the replacement is completed, until the old device is returned. Can be turned off per case.`
				: "Off for everyone",
			actions: change("returns", "old device return reminders"),
		},
		{
			key: "Booking lead time",
			value: `Colleagues can only book sessions more than ${plural(settings.bookingLeadWorkingDays, "working day")} away. The team can book on their behalf at any time.`,
			actions: change("lead", "booking lead time"),
		},
		{
			key: "Software lock",
			value: `${plural(settings.softwareLockWorkingDays, "working day")} before the session`,
			actions: change("lock", "software lock"),
		},
	];
}

function ChecklistSection({ list, items }: { list: ChecklistName; items: ChecklistItem[] }) {
	const { title, step } = CHECKLISTS[list];
	const id = list === "decommission" ? "decom" : "prep";
	return (
		<Section id={id} title={title}>
			<p className="bcp-secondary-text">
				{list === "decommission"
					? "Engineers tick every item on the case page before they can decommission an old device. Items show in this order."
					: "Engineers tick every check on the case page before the software step unlocks. Use this for the primary user change, updates and any other checks. Items show in this order."}
			</p>
			<InsetText>
				<p>
					Changes to this list only apply to cases that haven't progressed past step{" "}
					{step}.
				</p>
			</InsetText>
			<Table
				caption={title}
				captionHidden
				empty="No checks yet."
				columns={[
					{ key: "number", header: "No." },
					{ key: "label", header: "Check" },
					{ key: "actions", header: <span className="sr-only">Actions</span> },
				]}
				rows={items.map((item, index) => ({
					id: item.id,
					cells: {
						number: String(index + 1),
						label: item.label,
						actions: (
							<RowActions
								kind={list}
								id={item.id}
								name={item.label}
								first={index === 0}
								last={index === items.length - 1}
								editHref={`${SETTINGS}/checklists/${list}/${item.id}`}
							/>
						),
					},
				}))}
			/>
			<InlineAddForm
				action={addCheckAction.bind(null, list)}
				fields={[{ name: "label", label: "Add a check", width: "30" }]}
			/>
		</Section>
	);
}
