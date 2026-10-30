import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { getQueuedCase } from "@/services/replacements/laptops/lib/queue";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { removeCaseFromQueue } from "../../../actions";

export const metadata: Metadata = { title: "Remove from queue – Laptop replacements" };

const QUEUE = `${LAPTOPS_SECTIONS.import.href}/queue`;

/**
 * Removing withdraws the case, so it has a confirmation page like every
 * action that can't be undone. Not in the mockups.
 */
export default async function RemoveFromQueuePage({
	params,
}: {
	params: Promise<{ caseId: string }>;
}) {
	await requireRole(ACCESS.laptops);
	const queued = await getQueuedCase((await params).caseId);
	if (!queued) redirect(QUEUE);

	return (
		<LaptopsPage
			section="import"
			parents={[LAPTOPS_SECTIONS.import, { text: "Invitation queue", href: QUEUE }]}
			narrow
		>
			<PageHeading
				caption={`Case ${queued.reference} · ${queued.name}`}
				title={`Remove ${queued.name} from the invitation queue?`}
			/>
			<p>
				This withdraws case {queued.reference}, so {queued.firstName} will not be invited.
				The laptop will show on Eligible devices again, so it can be added to the queue
				later.
			</p>
			<form action={removeCaseFromQueue.bind(null, queued.caseId)}>
				<ButtonGroup>
					<Button type="submit" variant="warning">
						Remove from queue
					</Button>
					<Link href={QUEUE}>Go back</Link>
				</ButtonGroup>
			</form>
		</LaptopsPage>
	);
}
