import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { getSessionDefaults } from "@/services/replacements/laptops/lib/sessions";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SessionForm } from "../session-form";

export const metadata: Metadata = { title: "Add a session" };

export default async function AddSessionPage() {
	await requireRole(ACCESS.laptops);
	const defaults = await getSessionDefaults();

	return (
		<LaptopsPage section="sessions" parents={[LAPTOPS_SECTIONS.sessions]} narrow>
			<PageHeading title="Add a session" />
			<SessionForm
				sessionId={null}
				defaults={defaults}
				cancelHref={LAPTOPS_SECTIONS.sessions.href}
			/>
		</LaptopsPage>
	);
}
