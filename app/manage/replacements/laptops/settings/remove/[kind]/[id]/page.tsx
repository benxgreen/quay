import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import {
	CHECKLISTS,
	getChecklistItem,
	getFaq,
	getSoftware,
	isChecklistName,
} from "@/services/replacements/laptops/lib/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { removeItemAction } from "../../../actions";
import { SETTINGS } from "../../../definitions";

export const metadata: Metadata = { title: "Remove" };

/** The confirmation page before removing software, a question or a check. */
export default async function RemovePage({
	params,
}: {
	params: Promise<{ kind: string; id: string }>;
}) {
	const { kind, id } = await params;
	const found = await describe(kind, id);
	if (!found) notFound();

	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<PageHeading caption={`Settings · ${found.section}`} title={found.question} />
			<p>{found.effect}</p>
			<form action={removeItemAction.bind(null, kind, id)}>
				<ButtonGroup>
					<Button type="submit" variant="warning">
						{found.button}
					</Button>
					<Link href={`${SETTINGS}#${found.anchor}`}>Go back</Link>
				</ButtonGroup>
			</form>
		</LaptopsPage>
	);
}

async function describe(kind: string, id: string) {
	if (kind === "software") {
		const item = await getSoftware(id);
		return item
			? {
					section: "Software list",
					anchor: "software",
					question: `Remove ${item.name} from the software list?`,
					effect: "Colleagues will no longer see it as a choice when they book. Existing bookings keep it. You can add it again later.",
					button: "Remove software",
				}
			: null;
	}
	if (kind === "faq") {
		const item = await getFaq(id);
		return item
			? {
					section: "Frequently asked questions",
					anchor: "faqs",
					question: "Remove this question?",
					effect: `“${item.question}” will no longer be shown to colleagues.`,
					button: "Remove question",
				}
			: null;
	}
	if (isChecklistName(kind)) {
		const item = await getChecklistItem(kind, id);
		const { title, step } = CHECKLISTS[kind];
		return item
			? {
					section: title,
					anchor: kind === "decommission" ? "decom" : "prep",
					question: "Remove this check?",
					effect: `“${item.label}” will no longer be on the list for cases that haven't progressed past step ${step}. Cases already past that step keep it.`,
					button: "Remove check",
				}
			: null;
	}
	return null;
}
