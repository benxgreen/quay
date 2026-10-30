import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { SummaryList, SummaryListSecondary } from "@/components/ui/summary-list";
import { formatFullDate } from "@/lib/dates/format";
import { getPortalEmailTemplate } from "@/lib/portal/email-template";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";

export const metadata: Metadata = { title: "Portal settings" };

/** Settings for the whole portal (spec, "Users and Portal settings"). Administrator users only. */
export default async function PortalSettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ saved?: string }>;
}) {
	const { saved } = await searchParams;
	const template = await getPortalEmailTemplate();
	return (
		<TeamPage breadcrumbs={[MANAGE_BREADCRUMB]}>
			{saved === "template" ? (
				<NotificationBanner variant="success" heading="Email template saved" />
			) : null}
			<PageHeading title="Portal settings" />
			<h2>Emails</h2>
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
								href: "/manage/portal-settings/email-template",
								text: "Edit",
								visuallyHiddenText: "email template",
							},
						],
					},
				]}
			/>
		</TeamPage>
	);
}
