import type { Metadata } from "next";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Cookies" };

export default function CookiesPage() {
	return (
		<ColleaguePage>
			<PageHeading title="Cookies" />
			<InsetText>
				<p>
					Placeholder. The cookies page is written once sign-in (stage 4) sets its
					cookies.
				</p>
			</InsetText>
		</ColleaguePage>
	);
}
