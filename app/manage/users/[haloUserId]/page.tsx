import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamPage } from "@/components/layouts/team-page";
import { BackLink } from "@/components/ui/link";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { PageHeading } from "@/components/ui/page-heading";
import { Sidebar } from "@/components/ui/sidebar";
import { SummaryList } from "@/components/ui/summary-list";
import { Tag } from "@/components/ui/tag";
import { requireRole } from "@/lib/auth/guards";
import { formatShortDate, formatWhen } from "@/lib/dates/format";
import { ACCESS } from "@/lib/portal/access";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";
import { describeChange, getUserDetail, type UserDetail } from "@/lib/portal/users";
import { RolesForm } from "./roles-form";

type UserPageProps = {
	params: Promise<{ haloUserId: string }>;
	searchParams: Promise<{ saved?: string }>;
};

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params, searchParams }: UserPageProps) {
	const viewer = await requireRole(ACCESS.management);
	const haloUserId = Number((await params).haloUserId);
	if (!Number.isInteger(haloUserId) || haloUserId <= 0) notFound();

	const detail = await getUserDetail(haloUserId, {
		trigger: { kind: "user", label: "User page", actorUserId: viewer.id },
	});
	if (!detail) notFound();
	const { halo, portal } = detail;
	const saved = (await searchParams).saved === "1";

	return (
		<TeamPage
			breadcrumbs={[MANAGE_BREADCRUMB, { text: "Users", href: "/manage/users" }]}
			sidebar={<PortalUserPanel detail={detail} />}
		>
			<BackLink href="/manage/users" />
			{saved ? (
				<NotificationBanner
					variant="success"
					heading={`${halo.displayName}’s roles have been updated`}
				/>
			) : null}
			<PageHeading caption="User" title={halo.displayName} />

			<section>
				<h2>From the staff directory</h2>
				<SummaryList
					rows={[
						{ key: "Email", value: halo.email },
						{ key: "Username", value: halo.username ?? "–" },
						{ key: "Job title", value: halo.jobTitle ?? "–" },
						{ key: "Department", value: halo.department ?? "–" },
						{ key: "Manager", value: halo.manager ?? "–" },
					]}
				/>
				<p className="bcp-secondary-text">
					These details come from Halo and update each time {halo.firstName} signs in.
					They cannot be changed here.
				</p>
			</section>

			<RolesForm haloUserId={halo.haloUserId} roles={portal?.roles ?? []} />
		</TeamPage>
	);
}

const CREATED_VIA = {
	sign_in: () => "when they first signed in",
	case: (by: string | null) => (by ? `when added to a case by ${by}` : "when added to a case"),
	role_granted: (by: string | null) => (by ? `when given a role by ${by}` : "when given a role"),
};

function PortalUserPanel({ detail: { halo, portal } }: { detail: UserDetail }) {
	if (!portal) {
		return (
			<Sidebar label="Portal user">
				<h2 className="bcp-heading-md">Portal user</h2>
				<p>
					<Tag colour="grey">Directory only</Tag>
				</p>
				<p>
					{halo.firstName} does not have a portal user yet. One is created the first time
					something happens for {halo.firstName}:
				</p>
				<ul>
					<li>{halo.firstName} signs in</li>
					<li>{halo.firstName} is added to a case</li>
					<li>you save a role for {halo.firstName}</li>
				</ul>
			</Sidebar>
		);
	}

	return (
		<Sidebar label="Portal user">
			<h2 className="bcp-heading-md">Portal user</h2>
			<p>
				<Tag colour="green">Portal user</Tag>
			</p>
			<SummaryList
				stacked
				rows={[
					{
						key: "Created",
						value: `${formatShortDate(portal.createdAt)}, ${CREATED_VIA[portal.createdVia](portal.createdBy)}`,
					},
					{
						key: "Last signed in",
						value: portal.lastSignedInAt ? formatWhen(portal.lastSignedInAt) : "Never",
					},
					{
						key: "Cases",
						value:
							portal.cases.length > 0
								? portal.cases.map((c) => `${c.reference} (${c.status})`).join(", ")
								: `None for ${halo.firstName}`,
					},
				]}
			/>
			<h3>Role history</h3>
			{portal.roleHistory.length > 0 ? (
				<ul className="bcp-list--divided bcp-body-small">
					{portal.roleHistory.map((change) => (
						<li key={`${change.at.toISOString()}-${change.by}`}>
							{formatWhen(change.at)} · {describeChange(change)}
						</li>
					))}
				</ul>
			) : (
				<p className="bcp-body-small">No role changes.</p>
			)}
		</Sidebar>
	);
}
