import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { EmailTemplateEditor } from "@/components/patterns/email-editor";
import { PageHeading } from "@/components/ui/page-heading";
import { getPortalEmailTemplate } from "@/lib/portal/email-template";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";
import { savePortalTemplateAction } from "../actions";

export const metadata: Metadata = { title: "Email template" };

const PORTAL_SETTINGS = { text: "Portal settings", href: "/manage/portal-settings" };

/** Mockups: AdminEmailLayout. Administrator users only (the Portal settings layout checks). */
export default async function EmailTemplatePage() {
	const template = await getPortalEmailTemplate();
	return (
		<TeamPage breadcrumbs={[MANAGE_BREADCRUMB, PORTAL_SETTINGS]}>
			<PageHeading caption="Portal settings · Emails" title="Email template" />
			<p>
				The HTML used for every email the portal sends. Each email's content goes in place
				of {"{content}"}.
			</p>
			<EmailTemplateEditor
				action={savePortalTemplateAction}
				initial={template.html}
				teamName="[Team name]"
				cancelHref={PORTAL_SETTINGS.href}
			/>
		</TeamPage>
	);
}
