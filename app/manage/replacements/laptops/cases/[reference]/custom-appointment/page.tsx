import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { openAvailabilityRequest } from "@/services/replacements/laptops/lib/booking";
import { getSessionDefaults } from "@/services/replacements/laptops/lib/sessions";
import { loadForBooking } from "../book/load";
import { CustomForm } from "./custom-form";

export const metadata: Metadata = { title: "Book a custom appointment" };

/** Mockups: AdminActCustomBooking. Only for a case whose person can't attend any date. */
export default async function CustomAppointmentPage({
	params,
}: {
	params: Promise<{ reference: string }>;
}) {
	const { detail, href, crumbs } = await loadForBooking((await params).reference);
	if (detail.status !== "unbooked") redirect(href);
	const [defaults, request] = await Promise.all([
		getSessionDefaults(),
		openAvailabilityRequest(detail.id),
	]);
	const first = detail.person.firstName;
	const software = request?.software ?? [];

	return (
		<LaptopsPage section="cases" parents={crumbs} narrow>
			<PageHeading
				caption={`Case ${detail.reference} · ${detail.person.name}`}
				title="Book a custom appointment"
			/>
			<p>
				This is not linked to a published session and does not use a session place. {first}{" "}
				gets the same booking confirmation and reminder emails as everyone else.
			</p>
			<p>Software: {software.length ? software.join(", ") : "none requested yet"}.</p>
			<CustomForm
				reference={detail.reference}
				location={defaults[detail.type].location}
				time={defaults[detail.type].time}
				cancelHref={href}
			/>
		</LaptopsPage>
	);
}
