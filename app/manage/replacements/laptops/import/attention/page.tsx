import type { Metadata } from "next";
import { ShowMoreTable } from "@/components/patterns/show-more-table";
import { LaptopsPage } from "@/components/service/replacements/laptops-page";
import { Note } from "@/components/ui/note";
import { TableSecondary } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { formatAgo } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import type { ReportDevice } from "@/services/replacements/laptops/lib/import";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";
import { ImportHeader } from "../import-header";
import { loadImport } from "../load";

export const metadata: Metadata = { title: "Needs attention – Import – Laptop replacements" };

type AttentionPageProps = { searchParams: Promise<{ refreshFailed?: string }> };

/**
 * Laptops that can't be imported until their user is sorted out in Halo
 * (mockups: AdminImportAttention). "Open in Halo" links wait for Halo's web
 * addresses (lib/clients/halo/TODO.md).
 */
export default async function NeedsAttentionPage({ searchParams }: AttentionPageProps) {
	const user = await requireRole(ACCESS.laptops);
	const data = await loadImport(user.id);
	const attention = data.view?.attention ?? [];
	const { refreshFailed } = await searchParams;

	return (
		<LaptopsPage section="import" parents={[LAPTOPS_SECTIONS.import]}>
			<ImportHeader data={data} tab="attention" refreshFailed={refreshFailed} />
			{attention.length > 0 ? (
				<Note>
					<p>
						<strong>
							{attention.length} laptop{attention.length === 1 ? " needs" : "s need"}{" "}
							attention before {attention.length === 1 ? "it can" : "they can"} be
							imported.
						</strong>{" "}
						Fix the user in Halo, or check whether the person still works here, then
						refresh. Once fixed, the laptop moves to Eligible devices.
					</p>
				</Note>
			) : (
				<p>No laptops need attention.</p>
			)}
			{attention.length > 0 ? (
				<ShowMoreTable
					caption="Laptops that need attention"
					captionHidden
					noun="laptops"
					columns={[
						{ key: "laptop", header: "Laptop" },
						{ key: "user", header: "Assigned user" },
						{ key: "why", header: "What needs checking" },
						{ key: "seen", header: "Last seen" },
						{ key: "signIn", header: "Last sign in" },
					]}
					rows={attention.map((device) => ({
						id: device.assetId,
						cells: {
							laptop: (
								<>
									{device.serial}
									<TableSecondary>
										{device.hostname} · asset {device.assetId}
									</TableSecondary>
								</>
							),
							user: device.assignedUser?.name ?? "None",
							why: whatNeedsChecking(device),
							seen: formatAgo(new Date(device.lastSeen)),
							signIn: device.user?.lastSignIn
								? formatAgo(new Date(device.user.lastSignIn))
								: "–",
						},
					}))}
				/>
			) : null}
		</LaptopsPage>
	);
}

function whatNeedsChecking(device: ReportDevice): string {
	const name = device.assignedUser?.name ?? "";
	switch (device.userCheck) {
		case "no_user":
			return "No user is assigned to this laptop in Halo.";
		case "not_found":
			return `${name} was not found in the staff directory. They may have left.`;
		case "disabled":
			return `${name}’s account is disabled. They may have left.`;
		default:
			return "";
	}
}
