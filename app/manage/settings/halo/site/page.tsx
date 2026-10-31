import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamPage } from "@/components/layouts/team-page";
import { ValueForm } from "@/components/patterns/settings-form";
import { listConnections } from "@/lib/portal/connections";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";
import { saveConnectionAction } from "../../actions";

export const metadata: Metadata = { title: "Halo site" };

const PORTAL_SETTINGS = { text: "Portal settings", href: "/manage/portal-settings" };

/** The Halo site every service uses. The old link is never shown in full. */
export default async function HaloSitePage() {
	const halo = (await listConnections()).find((connection) => connection.key === "halo");
	if (!halo) notFound();
	return (
		<TeamPage breadcrumbs={[MANAGE_BREADCRUMB, PORTAL_SETTINGS]}>
			<ValueForm
				action={saveConnectionAction.bind(null, "halo", PORTAL_SETTINGS.href)}
				initial={{ value: "" }}
				title="Halo site"
				caption="Portal settings · Halo"
				hint={
					halo.urlStart
						? `The address of BCP's Halo, such as https://halohub.bcpcouncil.gov.uk. The current one starts ${halo.urlStart}`
						: "The address of BCP's Halo, such as https://halohub.bcpcouncil.gov.uk."
				}
				type="url"
				autoComplete="off"
				cancelHref={`${PORTAL_SETTINGS.href}#halo`}
			/>
		</TeamPage>
	);
}
