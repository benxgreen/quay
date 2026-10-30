import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { getFaq } from "@/services/replacements/laptops/lib/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { saveFaqAction } from "../../actions";
import { SETTINGS } from "../../definitions";
import { FaqForm } from "../../forms";

export const metadata: Metadata = { title: "Question" };

/** Mockups: AdminPageContent. Add a question (/faqs/new) or edit one. */
export default async function FaqPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const adding = id === "new";
	const faq = adding ? undefined : await getFaq(id);
	if (!adding && !faq) notFound();
	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<PageHeading
				caption="Settings · Frequently asked questions"
				title={adding ? "Add a question" : "Edit question"}
			/>
			<FaqForm
				action={saveFaqAction.bind(null, faq?.id ?? null)}
				initial={{
					question: faq?.question ?? "",
					answer: faq?.answer ?? "",
					shownFor: (faq?.shownFor ?? ["session", "collection"]).join(","),
				}}
				saveLabel={adding ? "Add question" : "Save"}
				cancelHref={`${SETTINGS}#faqs`}
			/>
		</LaptopsPage>
	);
}
