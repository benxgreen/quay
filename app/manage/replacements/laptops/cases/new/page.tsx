import type { Metadata } from "next";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { PageHeading } from "@/components/ui/page-heading";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { AddCaseForm } from "./add-case-form";

export const metadata: Metadata = { title: "Add a case – Laptop replacements" };

export default async function AddCasePage() {
	await requireRole(ACCESS.laptops);
	return (
		<LaptopsPage section="cases" parents={[LAPTOPS_SECTIONS.cases]} narrow>
			<PageHeading
				title="Add a case"
				lede="Enter the old laptop’s serial number. We look up the device and its assigned user in Halo."
			/>
			<AddCaseForm cancelHref={LAPTOPS_SECTIONS.cases.href} />
		</LaptopsPage>
	);
}
