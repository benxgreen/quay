import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { SoftwareChoice } from "@/components/service/replacements/software-choice";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { softwareList, splitSoftware } from "@/services/replacements/laptops/lib/booking";
import { myCase } from "@/services/replacements/laptops/lib/my-laptop";
import { chooseSoftware } from "../../actions";
import { LAPTOP_PAGE, withCase } from "../../wording";

export const metadata: Metadata = { title: "What software do you need?" };

type SoftwarePageProps = {
	searchParams: Promise<{ case?: string; session?: string; software?: string | string[] }>;
};

/** Mockups: UserSoftware. */
export default async function BookSoftwarePage({ searchParams }: SoftwarePageProps) {
	const user = await requireUser();
	const { case: token, session, software } = await searchParams;
	const found = await myCase(user.id, token);
	if (!found || found.booking || !session) redirect(`${LAPTOP_PAGE}/book${withCase(token)}`);
	const list = await softwareList();
	const { listed, other } = splitSoftware([software ?? []].flat(), list);

	return (
		<ColleaguePage backHref={`${LAPTOP_PAGE}/book${withCase(token, { session })}`}>
			<form action={chooseSoftware}>
				{token ? <input type="hidden" name="case" value={token} /> : null}
				<input type="hidden" name="session" value={session} />
				<SoftwareChoice
					list={list}
					selected={listed}
					other={other}
					legend="What software do you need?"
					caption="Book your laptop replacement"
					hint="This software will be made available for you to install when you receive your laptop. Select all that apply."
				/>
				<Button type="submit">Continue</Button>
			</form>
		</ColleaguePage>
	);
}
