import type { Metadata } from "next";
import { SelectsForm } from "@/components/patterns/settings-form";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { type HaloOption, listHaloReports } from "@/lib/clients/halo/discover";
import { getLaptopHaloSettings } from "@/services/replacements/laptops/lib/halo/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SETTINGS } from "../../definitions";
import { saveHaloReportsAction } from "../../halo-actions";
import { haloSettingsPage, readFailure } from "../load";

export const metadata: Metadata = { title: "Halo reports" };

/** Which Halo reports give the laptops eligible for replacement and the replacement stock. */
export default async function HaloReportsPage() {
	const { context } = await haloSettingsPage("Halo settings: reports");
	const settings = await getLaptopHaloSettings();
	let reports: HaloOption[] = [];
	let failed: string | null = null;
	try {
		reports = (await listHaloReports(context)).value;
	} catch (error) {
		failed = readFailure(error);
	}
	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<PageHeading caption="Settings · Halo" title="Reports" />
			{failed ? (
				<NotificationBanner variant="failed" heading="Halo's reports could not be read">
					<p>{failed}</p>
				</NotificationBanner>
			) : (
				<SelectsForm
					action={saveHaloReportsAction}
					initial={{
						eligible: String(settings.eligibleReportId),
						stock: settings.stockReportId ? String(settings.stockReportId) : "",
						ids: settings.idsReportId ? String(settings.idsReportId) : "",
					}}
					groups={[
						{
							fields: [
								{
									key: "eligible",
									label: "Laptops eligible for replacement",
									hint: "Shown on the Import screen. Needs Serial Number, Device Hostname, Manufacturer, Model, Full Name, Email Address, Supplier Purchase Date and Last Sync Time columns, and ideally ID.",
									options: reports,
								},
								{
									key: "stock",
									label: "Replacement stock",
									hint: "Needs ID, Serial Number, Device Name, Manufacturer, Model, Stock Location and Stock Room columns. Without one, the portal lists every laptop at the in stock status, 50 at a time.",
									options: reports,
									emptyLabel: "No stock report",
								},
								{
									key: "ids",
									label: "Laptop IDs",
									hint: "A report with ID and Serial Number for every laptop, used while the eligible report has no ID column.",
									options: reports,
									emptyLabel: "None",
								},
							],
						},
					]}
					cancelHref={`${SETTINGS}#halo`}
				/>
			)}
		</LaptopsPage>
	);
}
