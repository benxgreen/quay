import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";
import {
	CHECKLISTS,
	getChecklistItem,
	isChecklistName,
} from "@/services/replacements/laptops/lib/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { editCheckAction } from "../../../actions";
import { SETTINGS } from "../../../definitions";
import { CheckForm } from "../../../forms";

export const metadata: Metadata = { title: "Edit check" };

export default async function EditCheckPage({
	params,
}: {
	params: Promise<{ list: string; id: string }>;
}) {
	const { list, id } = await params;
	if (!isChecklistName(list)) notFound();
	const item = await getChecklistItem(list, id);
	if (!item) notFound();
	const { title, step } = CHECKLISTS[list];
	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<PageHeading caption={`Settings · ${title}`} title="Edit check" />
			<InsetText>
				<p>
					Changes to this list only apply to cases that haven't progressed past step{" "}
					{step}.
				</p>
			</InsetText>
			<CheckForm
				action={editCheckAction.bind(null, list, item.id)}
				initial={{ label: item.label }}
				cancelHref={`${SETTINGS}#${list === "decommission" ? "decom" : "prep"}`}
			/>
		</LaptopsPage>
	);
}
