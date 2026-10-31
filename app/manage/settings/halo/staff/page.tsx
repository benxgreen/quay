import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { requireRole } from "@/lib/auth/guards";
import { listHaloUserFields } from "@/lib/clients/halo/discover";
import { getHaloUserFieldMap, STAFF_FIELDS } from "@/lib/clients/halo/settings";
import { ACCESS } from "@/lib/portal/access";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";
import { saveHaloStaffFieldsAction } from "../../actions";
import { StaffFieldsForm } from "./staff-fields-form";

export const metadata: Metadata = { title: "User field mapping" };

const PORTAL_SETTINGS = { text: "Portal settings", href: "/manage/portal-settings" };

/** Which Halo user field gives each staff detail, chosen from the fields on a real Halo user. */
export default async function StaffFieldsPage() {
	const user = await requireRole(ACCESS.management);
	const map = await getHaloUserFieldMap();
	let fields: Awaited<ReturnType<typeof listHaloUserFields>>["value"] | null = null;
	let failed: string | null = null;
	try {
		fields = (
			await listHaloUserFields({
				trigger: {
					kind: "user",
					label: "Staff fields settings",
					actorUserId: user.actorId,
				},
			})
		).value;
	} catch (error) {
		failed = error instanceof Error ? error.message : String(error);
	}

	return (
		<TeamPage breadcrumbs={[MANAGE_BREADCRUMB, PORTAL_SETTINGS]}>
			<PageHeading caption="Portal settings · Halo · Field mapping" title="Users" />
			<p>
				Choose the Halo user field that gives each staff detail. The example column shows
				what each choice gives for one person in Halo.
			</p>
			{failed ? (
				<NotificationBanner variant="failed" heading="Halo's user fields could not be read">
					<p>{failed}</p>
				</NotificationBanner>
			) : (
				<StaffFieldsForm
					action={saveHaloStaffFieldsAction}
					fields={STAFF_FIELDS.map(({ key, label }) => ({ key, label }))}
					options={withSaved(
						fields?.options ?? [],
						STAFF_FIELDS.map(({ key }) => map[key]),
					)}
					sample={fields?.sample ?? null}
					initial={Object.fromEntries(
						STAFF_FIELDS.map(({ key }) => [key, map[key] ?? ""]),
					)}
					cancelHref={`${PORTAL_SETTINGS.href}#halo`}
				/>
			)}
		</TeamPage>
	);
}

/** The saved choices stay in the lists even when the example person doesn't have that field. */
function withSaved(
	options: { value: string; label: string }[],
	saved: (string | null)[],
): { value: string; label: string }[] {
	const missing = saved
		.filter((field): field is string => Boolean(field))
		.filter((field) => !options.some((option) => option.value === field))
		.map((field) => ({ value: field, label: `${field} (not on the example person)` }));
	return [...options, ...missing];
}
