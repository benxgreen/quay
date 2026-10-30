import type { Metadata } from "next";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { Link } from "@/components/ui/link";
import { Panel } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth/guards";
import { LAPTOP_PAGE, withCase } from "../../wording";

export const metadata: Metadata = { title: "Request sent" };

/** Mockups: UserAvailabilitySent. */
export default async function AvailabilitySentPage({
	searchParams,
}: {
	searchParams: Promise<{ case?: string }>;
}) {
	await requireUser();
	const { case: token } = await searchParams;
	return (
		<ColleaguePage>
			<Panel title="Request sent">We have received your availability</Panel>
			<h2>What happens next</h2>
			<p>The team will contact you by email to arrange a time that suits you.</p>
			<p>We have paused your booking reminders while we do this.</p>
			<p>
				If one of the published dates becomes suitable, you can still{" "}
				<Link href={`${LAPTOP_PAGE}/book${withCase(token)}`}>book it yourself</Link>.
			</p>
		</ColleaguePage>
	);
}
