import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { getSession } from "@/services/replacements/laptops/lib/sessions";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { confirmCancelSession } from "../../actions";
import { sessionCrumb, sessionTitle } from "../../session-text";

export const metadata: Metadata = { title: "Cancel session – Laptop replacements" };

/** Mockups: AdminSessionCancel. */
export default async function CancelSessionPage({ params }: { params: Promise<{ id: string }> }) {
	await requireRole(ACCESS.laptops);
	const { id } = await params;
	const session = await getSession(id);
	if (!session) notFound();
	const href = `${LAPTOPS_SECTIONS.sessions.href}/${id}`;
	const cancellable =
		(session.status === "open" || session.status === "full") && session.startsAt > new Date();
	if (!cancellable) redirect(href);

	const booked = session.booked;
	const people = `${booked} ${booked === 1 ? "person is" : "people are"}`;

	return (
		<LaptopsPage
			section="sessions"
			parents={[LAPTOPS_SECTIONS.sessions, { text: sessionCrumb(session), href }]}
			narrow
		>
			<PageHeading
				caption={`Session · ${sessionTitle(session)}`}
				title="Are you sure you want to cancel this session?"
			/>
			{booked > 0 ? (
				<>
					<p>{people} booked on this session. Cancelling it will:</p>
					<ul>
						<li>
							cancel {booked === 1 ? "the booking" : `all ${booked} bookings`} and
							move {booked === 1 ? "the case" : "each case"} to Rebook required
						</li>
						<li>
							email {booked === 1 ? "them" : "each person"} to say the session has
							been cancelled and they need to choose a new date
						</li>
						<li>
							mark the session as Cancelled, so it no longer appears in upcoming
							sessions
						</li>
						<li>restart weekly booking reminders until they rebook</li>
						<li>keep any allocated devices and software choices on the cases</li>
					</ul>
				</>
			) : (
				<p>
					No one is booked on this session. Cancelling it will mark it as Cancelled, so it
					no longer appears in upcoming sessions.
				</p>
			)}
			<form action={confirmCancelSession.bind(null, id)}>
				<Textarea
					id="reason"
					name="reason"
					label="Reason (optional)"
					hint="Saved on the session and in each case’s journal, for example “the room is no longer available”. The people booked will not see it."
					maxLength={500}
				/>
				<ButtonGroup>
					<Button type="submit" variant="warning">
						Cancel session
					</Button>
					<Link href={href}>Go back</Link>
				</ButtonGroup>
			</form>
		</LaptopsPage>
	);
}
