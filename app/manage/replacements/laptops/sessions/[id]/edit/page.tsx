import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { getSession, getSessionDefaults } from "@/services/replacements/laptops/lib/sessions";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SessionForm } from "../../session-form";
import { sessionCrumb } from "../../session-text";

export const metadata: Metadata = { title: "Edit session – Laptop replacements" };

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
	await requireRole(ACCESS.laptops);
	const { id } = await params;
	const [session, defaults] = await Promise.all([getSession(id), getSessionDefaults()]);
	if (!session) notFound();
	const href = `${LAPTOPS_SECTIONS.sessions.href}/${id}`;
	if (session.cancelled) redirect(href);

	const [year, month, day] = session.date.split("-");
	const [hour, minute] = session.time.split(":");

	return (
		<LaptopsPage
			section="sessions"
			parents={[LAPTOPS_SECTIONS.sessions, { text: sessionCrumb(session), href }]}
			narrow
		>
			<PageHeading title="Edit session" />
			<SessionForm
				sessionId={id}
				defaults={defaults}
				booked={session.booked}
				initial={{
					type: session.type,
					day: String(Number(day)),
					month: String(Number(month)),
					year,
					hour,
					minute,
					capacity: String(session.capacity),
					location: session.location,
				}}
				cancelHref={href}
			/>
		</LaptopsPage>
	);
}
