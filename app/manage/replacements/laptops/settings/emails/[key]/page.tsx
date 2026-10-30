import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmailEditor } from "@/components/patterns/email-editor";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { Tag } from "@/components/ui/tag";
import { getPortalEmailTemplate } from "@/lib/portal/email-template";
import { LAPTOP_EMAIL_VARIABLES, LAPTOP_EMAILS } from "@/services/replacements/laptops/lib/emails";
import {
	exampleValues,
	getEmailSender,
	getEmailTemplate,
	isLaptopEmailKey,
} from "@/services/replacements/laptops/lib/emails/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SETTINGS } from "../../definitions";
import { saveEmailAction } from "../../email-actions";

export const metadata: Metadata = { title: "Edit email" };

/** Mockups: AdminEmailEdit. */
export default async function EditEmailPage({ params }: { params: Promise<{ key: string }> }) {
	const { key } = await params;
	if (!isLaptopEmailKey(key)) notFound();
	const email = LAPTOP_EMAILS.find((item) => item.key === key);
	const [template, sender, layout] = await Promise.all([
		getEmailTemplate(key),
		getEmailSender(),
		getPortalEmailTemplate(),
	]);
	if (!email || !template) notFound();

	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]}>
			<PageHeading caption="Settings · Emails" title={email.name} />
			<p>{email.sentWhen}</p>
			<p>
				{email.timing.kind === "automatic" ? (
					<>
						<Tag colour="grey">Automatic</Tag> Sent by the system when it happens. The
						timing cannot be changed.
					</>
				) : (
					<>
						<Tag colour="grey">Setting</Tag> The timing is set in Settings ›{" "}
						{email.timing.setting}.
					</>
				)}
			</p>
			<EmailEditor
				action={saveEmailAction.bind(null, key)}
				initial={{
					subject: template.subject,
					preheader: template.preheader,
					body: template.bodyMarkdown,
				}}
				variables={LAPTOP_EMAIL_VARIABLES.map(({ name, description, example }) => ({
					name,
					description,
					example,
				}))}
				examples={exampleValues(sender.teamName)}
				layoutHtml={layout.html}
				sender={sender}
				exampleTo="ellie.ward@bcpcouncil.gov.uk"
				cancelHref={`${SETTINGS}#emails`}
			/>
		</LaptopsPage>
	);
}
