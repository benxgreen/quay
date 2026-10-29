import type { Metadata } from "next";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { InsetText } from "@/components/ui/inset-text";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Your devices" };

export default function YourDevicesPage() {
	return (
		<ColleaguePage>
			<PageHeading caption="Device portal" title="Your devices" />
			<InsetText>
				<p>
					Placeholder for the portal home. The laptop replacement panel is built in stage
					9.
				</p>
			</InsetText>
		</ColleaguePage>
	);
}
