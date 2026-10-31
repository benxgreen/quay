import type { Metadata } from "next";
import { SelectsForm } from "@/components/patterns/settings-form";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import {
	getHaloAssetTypeDetails,
	type HaloAssetTypeDetails,
	type HaloOption,
	listHaloAssetTypes,
} from "@/lib/clients/halo/discover";
import { getLaptopHaloSettings } from "@/services/replacements/laptops/lib/halo/settings";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { SETTINGS } from "../../definitions";
import { saveHaloLaptopsAction } from "../../halo-actions";
import { haloSettingsPage, readFailure } from "../load";

export const metadata: Metadata = { title: "Halo laptop fields" };

/**
 * The laptop asset type, its statuses, the fields the portal reads and
 * writes, and the values written to an old laptop. Options are read from
 * Halo for the saved asset type; changing the type and saving shows the new
 * type's fields.
 */
export default async function HaloLaptopsPage() {
	const { context } = await haloSettingsPage("Halo settings: laptop fields");
	const settings = await getLaptopHaloSettings();
	let types: HaloOption[] = [];
	let details: HaloAssetTypeDetails = { fields: [], lookups: {}, statuses: [] };
	let failed: string | null = null;
	try {
		[types, details] = await Promise.all([
			listHaloAssetTypes(context).then((r) => r.value),
			getHaloAssetTypeDetails(settings.laptopTypeId, context).then((r) => r.value),
		]);
	} catch (error) {
		failed = readFailure(error);
	}
	const initial = Object.fromEntries(
		Object.entries(settings).map(([key, value]) => [key, value == null ? "" : String(value)]),
	);
	const field = (key: string, label: string, hint?: string) => ({
		key,
		label,
		hint,
		options: details.fields,
	});

	return (
		<LaptopsPage section="settings" parents={[LAPTOPS_SECTIONS.settings]} narrow>
			<PageHeading caption="Settings · Halo" title="Laptop fields and values" />
			{failed ? (
				<NotificationBanner
					variant="failed"
					heading="Halo's laptop details could not be read"
				>
					<p>{failed}</p>
				</NotificationBanner>
			) : (
				<SelectsForm
					action={saveHaloLaptopsAction}
					initial={initial}
					groups={[
						{
							fields: [
								{
									key: "laptopTypeId",
									label: "Laptop asset type",
									hint: "If you change this, save, then come back to choose the new type's fields.",
									options: types,
								},
							],
						},
						{
							heading: "Statuses",
							hint: "Halo has no list of statuses, so these are the ones found on laptops.",
							fields: [
								{
									key: "statusInStock",
									label: "In stock",
									hint: "Replacement laptops waiting to be allocated",
									options: details.statuses,
								},
								{
									key: "statusInService",
									label: "In service",
									hint: "Set on the new laptop when the replacement is completed",
									options: details.statuses,
								},
								{
									key: "statusOutOfService",
									label: "Out of service",
									hint: "Set on the old laptop when it is decommissioned",
									options: details.statuses,
								},
							],
						},
						{
							heading: "Fields",
							fields: [
								field("fieldSerial", "Serial number"),
								field("fieldStockLocation", "Stock location"),
								field("fieldStockRoom", "Stock room"),
								field("fieldLastAuditDate", "Last audit date"),
								field("fieldAuditDetails", "Audit details"),
								{
									...field(
										"fieldLastSync",
										"Last sync time",
										"Shown as when the laptop was last seen",
									),
									emptyLabel: "Not used",
								},
							],
						},
						{
							heading: "Values written to the old laptop",
							fields: [
								{
									key: "locationDecommissioned",
									label: "Stock location when decommissioned",
									options:
										details.lookups[String(settings.fieldStockLocation)] ?? [],
								},
								{
									key: "roomReturned",
									label: "Stock room when returned and decommissioned",
									options: details.lookups[String(settings.fieldStockRoom)] ?? [],
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
