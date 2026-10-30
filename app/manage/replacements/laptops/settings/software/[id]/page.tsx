import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { getSoftware } from "@/services/replacements/laptops/lib/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { editSoftwareAction } from "../../actions";
import { SETTINGS } from "../../definitions";
import { SoftwareForm } from "../../forms";

export const metadata: Metadata = { title: "Edit software" };

export default async function EditSoftwarePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const item = await getSoftware(id);
	if (!item) notFound();
	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<PageHeading caption="Settings · Software list" title="Edit software" />
			<p>Existing bookings keep the name they were saved with.</p>
			<SoftwareForm
				action={editSoftwareAction.bind(null, item.id)}
				initial={{ name: item.name, hint: item.hint ?? "" }}
				cancelHref={`${SETTINGS}#software`}
			/>
		</LaptopsPage>
	);
}
