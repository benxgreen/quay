import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { Link } from "@/components/ui/link";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { PendingButton } from "@/components/ui/pending-button";
import { Sidebar } from "@/components/ui/sidebar";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { formatFullDate, formatUpdatedAt } from "@/lib/dates/format";
import { listConnections } from "@/lib/portal/connections";
import { getPortalEmailTemplate } from "@/lib/portal/email-template";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";
import { testHaloConnectionAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const BASE = "/manage/settings";

const SECTIONS = [
	{ id: "halo", text: "Halo" },
	{ id: "entra", text: "Entra ID" },
	{ id: "emails", text: "Emails" },
];

const SAVED: Record<string, string> = {
	template: "Email template saved",
	connection: "Halo site saved",
	"staff-fields": "User field mapping saved",
};

/**
 * Settings for the whole portal (spec, "Users and Portal settings"), laid out
 * like a service's Settings: "On this page" on the left. Administrator users only.
 */
export default async function PortalSettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ saved?: string; tested?: string; users?: string; message?: string }>;
}) {
	const { saved, tested, users, message } = await searchParams;
	const [template, connections] = await Promise.all([
		getPortalEmailTemplate(),
		listConnections(),
	]);
	const halo = connections.find((connection) => connection.key === "halo");
	const entraReady = Boolean(
		process.env.ENTRA_CLIENT_ID &&
			process.env.ENTRA_CLIENT_SECRET &&
			process.env.ENTRA_TENANT_ID,
	);

	return (
		<TeamPage
			breadcrumbs={[MANAGE_BREADCRUMB]}
			sidebarPosition="start"
			sidebarHeader={
				<>
					{saved && SAVED[saved] ? (
						<NotificationBanner variant="success" heading={SAVED[saved]} />
					) : null}
					{tested === "ok" ? (
						<NotificationBanner variant="success" heading="Halo connection works">
							<p>Signed in and read the staff directory ({users} users).</p>
						</NotificationBanner>
					) : tested === "failed" ? (
						<NotificationBanner variant="failed" heading="Halo connection failed">
							<p>{message}</p>
						</NotificationBanner>
					) : null}
					<PageHeading title="Settings" />
				</>
			}
			sidebar={
				<Sidebar label="On this page">
					<ul className="bcp-list--plain bcp-list--spaced">
						{SECTIONS.map((section) => (
							<li key={section.id}>
								<Link href={`#${section.id}`}>{section.text}</Link>
							</li>
						))}
					</ul>
				</Sidebar>
			}
		>
			<section id="halo" aria-labelledby="halo-heading" className="bcp-section">
				<h2 id="halo-heading">Halo</h2>
				<p className="bcp-secondary-text">
					The Halo connection every service uses, and which Halo fields give the portal's
					details.
				</p>
				<SummaryList
					rows={[
						{
							key: "Halo site",
							value: (
								<>
									<span className="bcp-break-all">
										{halo?.urlStart ?? "Not set"}
									</span>
									<SummaryListSecondary>
										{halo?.lastUsedAt
											? `Last used ${formatUpdatedAt(halo.lastUsedAt)}`
											: "Not used in the last 7 days"}
									</SummaryListSecondary>
								</>
							),
							actions: [
								{ href: `${BASE}/halo/site`, visuallyHiddenText: "Halo site" },
							],
						},
						{
							key: "Field mapping",
							value: "Users",
							actions: [
								{
									href: `${BASE}/halo/staff`,
									visuallyHiddenText: "user field mapping",
								},
							],
						},
					]}
				/>
				<form action={testHaloConnectionAction}>
					<PendingButton variant="secondary" pendingText="Testing connection…">
						Test connection
					</PendingButton>
				</form>
			</section>

			<section id="entra" aria-labelledby="entra-heading" className="bcp-section">
				<h2 id="entra-heading">Entra ID</h2>
				<p className="bcp-secondary-text">
					Microsoft sign-in, and the details that only Entra ID has. Coming once the app
					registration with the security team is ready.
				</p>
				<SummaryList
					rows={[
						{
							key: "Sign-in",
							value: entraReady
								? "Set up"
								: "Not set up yet. Staff sign in with the development sign-in until it is.",
						},
						{
							key: "Username",
							value: (
								<>
									Will come from Entra ID
									<SummaryListSecondary>
										With the domain, such as bcp\ben.green, which Halo doesn't
										hold
									</SummaryListSecondary>
								</>
							),
						},
					]}
				/>
			</section>

			<section id="emails" aria-labelledby="emails-heading" className="bcp-section">
				<h2 id="emails-heading">Emails</h2>
				<SummaryList
					rows={[
						{
							key: "Email template",
							value: (
								<>
									The HTML every service's emails are sent in
									<SummaryListSecondary>
										{template.updatedAt
											? `Last changed ${formatFullDate(template.updatedAt)}${template.updatedBy ? ` by ${template.updatedBy}` : ""}`
											: "Not changed since setup"}
									</SummaryListSecondary>
								</>
							),
							actions: [
								{
									href: `${BASE}/email-template`,
									text: "Edit",
									visuallyHiddenText: "email template",
								},
							],
						},
					]}
				/>
			</section>
		</TeamPage>
	);
}
