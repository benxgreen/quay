import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { listDefaults } from "@/services/replacements/laptops/lib/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { saveDefaultsAction } from "../../actions";
import { SETTINGS } from "../../definitions";
import { DefaultsForm } from "../../forms";

export const metadata: Metadata = { title: "Session defaults" };

export default async function DefaultsPage({ params }: { params: Promise<{ type: string }> }) {
	const { type } = await params;
	if (type !== "session" && type !== "collection") notFound();
	const item = (await listDefaults()).find((row) => row.type === type);
	const [hour, minute] = (item?.time ?? "10:00").split(":");
	const word = type === "session" ? "Session" : "Collection";
	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<PageHeading caption="Settings · Session defaults" title={`${word} defaults`} />
			<p>
				Filled in when you add a {word.toLowerCase()}. Changing them doesn't change sessions
				already added.
			</p>
			<DefaultsForm
				action={saveDefaultsAction.bind(null, type)}
				initial={{
					"time-hour": hour,
					"time-minute": minute,
					capacity: String(item?.capacity ?? ""),
					location: item?.location ?? "",
				}}
				cancelHref={`${SETTINGS}#defaults`}
			/>
		</LaptopsPage>
	);
}
