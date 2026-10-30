import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkdownForm } from "@/components/patterns/settings-form";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { listContent } from "@/services/replacements/laptops/lib/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { saveContentAction } from "../../actions";
import { SETTINGS } from "../../definitions";

export const metadata: Metadata = { title: "Edit page content" };

/** Mockups: AdminMainContent. */
export default async function ContentPage({ params }: { params: Promise<{ type: string }> }) {
	const { type } = await params;
	if (type !== "session" && type !== "collection") notFound();
	const item = (await listContent()).find((row) => row.type === type);
	const word = type === "session" ? "Session" : "Collection";
	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<PageHeading caption="Settings · Portal content" title={`Edit page content: ${word}`} />
			<p>
				Shown to colleagues booked onto a {word}, under their booking and software details.
				Frequently asked questions are added separately.
			</p>
			<MarkdownForm
				action={saveContentAction.bind(null, type)}
				initial={{ body: item?.body ?? "" }}
				cancelHref={`${SETTINGS}#page`}
			/>
		</LaptopsPage>
	);
}
