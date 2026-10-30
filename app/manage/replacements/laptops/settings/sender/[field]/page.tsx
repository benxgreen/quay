import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { getEmailSender } from "@/services/replacements/laptops/lib/emails/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SETTINGS } from "../../definitions";
import { saveSenderAction } from "../../email-actions";
import { ValueForm } from "../../forms";

export const metadata: Metadata = { title: "Emails" };

/** Team name or Sent from (/sender/team, /sender/from). */
export default async function SenderPage({ params }: { params: Promise<{ field: string }> }) {
	const { field } = await params;
	if (field !== "team" && field !== "from") notFound();
	const sender = await getEmailSender();
	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			{field === "team" ? (
				<ValueForm
					action={saveSenderAction.bind(null, "team")}
					initial={{ value: sender.teamName }}
					title="Team name"
					caption="Settings · Emails"
					hint="Shown as the sender name and used in emails as {team_name}."
					cancelHref={`${SETTINGS}#emails`}
				/>
			) : (
				<ValueForm
					action={saveSenderAction.bind(null, "from")}
					initial={{ value: sender.sentFrom }}
					title="Sent from"
					caption="Settings · Emails"
					hint="The mailbox laptop replacement emails are sent from. Power Automate must be allowed to send from it."
					type="email"
					autoComplete="off"
					cancelHref={`${SETTINGS}#emails`}
				/>
			)}
		</LaptopsPage>
	);
}
