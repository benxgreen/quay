import { Button } from "@/components/ui/button";
import { NotificationBanner, NotificationBannerDetail } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { SecondaryNavigation } from "@/components/ui/secondary-navigation";
import { formatUpdatedAt } from "@/lib/dates/format";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { refreshFromHalo } from "./actions";
import type { ImportData } from "./load";

export const IMPORT_BASE = LAPTOPS_SECTIONS.import.href;

export type ImportTab = "eligible" | "attention" | "queue";

const TAB_HREFS: Record<ImportTab, string> = {
	eligible: IMPORT_BASE,
	attention: `${IMPORT_BASE}/attention`,
	queue: `${IMPORT_BASE}/queue`,
};

/**
 * The top of every Import tab (mockups: AdminImport): the heading with
 * "Refresh from Halo", when the report was last read, and the three tabs
 * with their counts.
 */
export function ImportHeader({
	data,
	tab,
	refreshFailed,
}: {
	data: ImportData;
	tab: ImportTab;
	/** The message from a failed "Refresh from Halo". */
	refreshFailed?: string;
}) {
	const { view, queued, firstLoadFailed } = data;
	const failure = refreshFailed ?? firstLoadFailed;

	return (
		<>
			{failure ? (
				<NotificationBanner variant="failed" heading="Halo could not be reached">
					<NotificationBannerDetail>
						{failure}. Nothing has changed. Try again in a few minutes.
					</NotificationBannerDetail>
				</NotificationBanner>
			) : null}
			<PageHeading title="Import">
				<form action={refreshFromHalo}>
					<input type="hidden" name="returnTo" value={TAB_HREFS[tab]} />
					<Button type="submit" variant="secondary">
						Refresh from Halo
					</Button>
				</form>
			</PageHeading>
			<p className="bcp-secondary-text">
				{view
					? `Updated from Halo at ${formatUpdatedAt(view.report.fetchedAt)}.`
					: "The Halo report has not been read yet."}
			</p>
			<SecondaryNavigation
				label="Import"
				items={[
					{
						text: "Eligible devices",
						href: TAB_HREFS.eligible,
						count: view?.eligible.length ?? 0,
						current: tab === "eligible",
					},
					{
						text: "Needs attention",
						href: TAB_HREFS.attention,
						count: view?.attention.length ?? 0,
						current: tab === "attention",
					},
					{
						text: "Invitation queue",
						href: TAB_HREFS.queue,
						count: queued,
						current: tab === "queue",
					},
				]}
			/>
		</>
	);
}
