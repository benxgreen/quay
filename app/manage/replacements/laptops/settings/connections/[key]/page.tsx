import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { saveConnectionAction } from "@/app/manage/settings/actions";
import { ValueForm } from "@/components/patterns/settings-form";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS, canAccess } from "@/lib/portal/access";
import { listConnections } from "@/lib/portal/connections";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SETTINGS } from "../../definitions";

export const metadata: Metadata = { title: "Change connection" };

/** Settings › Connections: a new link. Administrator users only; the old link is never shown in full. */
export default async function ConnectionPage({ params }: { params: Promise<{ key: string }> }) {
	const user = await requireRole(ACCESS.laptopsSettings);
	if (!canAccess(user.roles, ACCESS.management)) redirect(SETTINGS);
	const { key } = await params;
	const connection = (await listConnections()).find((item) => item.key === key);
	// The Halo site is portal-wide: changed in portal Settings.
	if (!connection || key === "halo") notFound();
	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<ValueForm
				action={saveConnectionAction.bind(null, key, SETTINGS)}
				initial={{ value: "" }}
				title={connection.label}
				caption="Settings · Connections"
				hint={
					connection.urlStart
						? `Paste the whole new link. The current one starts ${connection.urlStart}`
						: "Paste the whole link. There is no link yet, so this connection can't be used."
				}
				type="url"
				autoComplete="off"
				cancelHref={`${SETTINGS}#connections`}
			/>
		</LaptopsPage>
	);
}
