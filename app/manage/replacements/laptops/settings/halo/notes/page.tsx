import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { getLaptopHaloSettings } from "@/services/replacements/laptops/lib/halo/settings";
import { variableList } from "@/services/replacements/laptops/lib/variables";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SETTINGS } from "../../definitions";
import { saveHaloNotesAction } from "../../halo-actions";
import { haloSettingsPage } from "../load";
import { NotesForm } from "./notes-form";

export const metadata: Metadata = { title: "Halo audit notes" };

/** The wording written to a laptop's Audit Details in Halo. */
export default async function HaloNotesPage() {
	await haloSettingsPage("Halo settings: audit notes");
	const settings = await getLaptopHaloSettings();
	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<PageHeading caption="Settings · Halo" title="Audit notes" />
			<p>
				Written to the laptop's Audit Details in Halo, with today's date as its Last Audit
				Date.
			</p>
			<NotesForm
				action={saveHaloNotesAction}
				initial={{
					collectedNote: settings.collectedNote,
					returnedNote: settings.returnedNote,
				}}
				variables={variableList("audit")}
				cancelHref={`${SETTINGS}#halo`}
			/>
		</LaptopsPage>
	);
}
