import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { getQueuedCase } from "@/services/replacements/laptops/lib/queue";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { ChangeTypeForm } from "./change-type-form";

export const metadata: Metadata = { title: "Change type – Invitation queue – Laptop replacements" };

const QUEUE = `${LAPTOPS_SECTIONS.import.href}/queue`;

export default async function ChangeTypePage({ params }: { params: Promise<{ caseId: string }> }) {
	await requireRole(ACCESS.laptops);
	const queued = await getQueuedCase((await params).caseId);
	if (!queued) redirect(QUEUE);

	return (
		<LaptopsPage
			section="import"
			parents={[LAPTOPS_SECTIONS.import, { text: "Invitation queue", href: QUEUE }]}
			narrow
		>
			<ChangeTypeForm
				caseId={queued.caseId}
				reference={queued.reference}
				name={queued.name}
				firstName={queued.firstName}
				position={queued.position}
				type={queued.type}
				cancelHref={QUEUE}
			/>
		</LaptopsPage>
	);
}
