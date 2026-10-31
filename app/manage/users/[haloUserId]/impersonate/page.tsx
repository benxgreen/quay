import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TeamPage } from "@/components/layouts/team-page";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { PageHeading } from "@/components/ui/page-heading";
import { SummaryList } from "@/components/ui/summary-list";
import { WarningText } from "@/components/ui/warning-text";
import { getRealUser } from "@/lib/auth/current-user";
import { requireRole } from "@/lib/auth/guards";
import { getPortalUserByHaloId } from "@/lib/auth/impersonation";
import { ACCESS } from "@/lib/portal/access";
import { canImpersonate, describeRoles } from "@/lib/portal/impersonation";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";
import { startImpersonation } from "../../impersonation-actions";

export const metadata: Metadata = { title: "Impersonate user" };

/** The confirmation page before an Administrator sees the portal as someone else. */
export default async function ImpersonatePage({
	params,
}: {
	params: Promise<{ haloUserId: string }>;
}) {
	const current = await requireRole(ACCESS.management);
	const haloUserId = Number((await params).haloUserId);
	if (!Number.isInteger(haloUserId) || haloUserId <= 0) notFound();
	const userHref = `/manage/users/${haloUserId}`;

	const [real, target] = await Promise.all([getRealUser(), getPortalUserByHaloId(haloUserId)]);
	if (!real || !target || !canImpersonate(real, current, target.id)) redirect(userHref);

	return (
		<TeamPage
			breadcrumbs={[
				MANAGE_BREADCRUMB,
				{ text: "Users", href: "/manage/users" },
				{ text: target.displayName, href: userHref },
			]}
			narrow
		>
			<PageHeading
				caption={target.displayName}
				title={`Impersonate ${target.displayName}?`}
			/>
			<p>You will see the portal as {target.displayName} does, with their roles:</p>
			<SummaryList rows={[{ key: "Roles", value: describeRoles(target.roles) }]} />
			<p>
				Anything you do while impersonating is recorded as done by you. A banner at the top
				of every page reminds you, with a link to stop. It stops by itself after 8 hours.
			</p>
			<WarningText>
				You will not be able to change Users or Settings unless {target.displayName} can.
			</WarningText>
			<form action={startImpersonation.bind(null, haloUserId)}>
				<ButtonGroup>
					<Button type="submit">Impersonate {target.displayName}</Button>
					<Link href={userHref}>Cancel</Link>
				</ButtonGroup>
			</form>
		</TeamPage>
	);
}
