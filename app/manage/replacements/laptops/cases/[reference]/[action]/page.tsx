import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { requireRole } from "@/lib/auth/guards";
import { formatLongDate, formatTime } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import {
	availableActions,
	type CaseAction,
	getCase,
} from "@/services/replacements/laptops/lib/cases";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { ConfirmAction } from "./confirm-action";

export const metadata: Metadata = { title: "Case action – Laptop replacements" };

const ACTIONS: readonly CaseAction[] = [
	"resend-booking",
	"resend-invitation",
	"cancel-booking",
	"did-not-attend",
	"flag",
	"clear-flag",
	"change-type",
	"withdraw",
];

export default async function CaseActionPage({
	params,
}: {
	params: Promise<{ reference: string; action: string }>;
}) {
	const { reference, action } = await params;
	if (!ACTIONS.includes(action as CaseAction)) notFound();
	await requireRole(action === "withdraw" ? ACCESS.laptopsSettings : ACCESS.laptops);
	const detail = await getCase(reference);
	if (!detail) notFound();
	const caseHref = `${LAPTOPS_SECTIONS.cases.href}/${reference}`;
	if (!availableActions(detail).includes(action as CaseAction)) redirect(caseHref);

	const booking = detail.booking;
	return (
		<LaptopsPage
			section="cases"
			parents={[LAPTOPS_SECTIONS.cases, { text: detail.person.name, href: caseHref }]}
			narrow
		>
			<ConfirmAction
				action={action as CaseAction}
				data={{
					reference: detail.reference,
					name: detail.person.name,
					firstName: detail.person.firstName,
					email: detail.person.email,
					serial: detail.oldDevice.serial,
					type: detail.type,
					status: detail.status,
					bookingWhen: booking
						? `${formatLongDate(booking.date, { year: true })} at ${formatTime(booking.time)}`
						: null,
					bookingWhere: booking?.location ?? null,
					software: booking?.software ?? null,
					boxNumber: detail.boxNumber,
					flagReason: detail.flag?.reason ?? null,
					caseHref,
				}}
			/>
		</LaptopsPage>
	);
}
