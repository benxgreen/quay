import type { Metadata } from "next";
import { TeamPage } from "@/components/layouts/team-page";
import { FilterBar } from "@/components/patterns/filter-bar";
import { PageHeading } from "@/components/ui/page-heading";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { MANAGE_BREADCRUMB } from "@/lib/portal/navigation";
import { PORTAL_ROLES, ROLE_LABELS } from "@/lib/portal/roles";
import { countUsers, listUsers, parseUserFilters } from "@/lib/portal/users";
import { toTableRows } from "./rows";
import { UsersTable } from "./users-table";

export const metadata: Metadata = { title: "Users" };

const number = new Intl.NumberFormat("en-GB");

type UsersPageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function UsersPage({ searchParams }: UsersPageProps) {
	const user = await requireRole(ACCESS.management);
	const filters = parseUserFilters(await searchParams);
	const context = {
		trigger: { kind: "user" as const, label: "Users", actorUserId: user.actorId },
	};
	const [page, counts] = await Promise.all([listUsers(filters, 0, context), countUsers(context)]);

	return (
		<TeamPage breadcrumbs={[MANAGE_BREADCRUMB]}>
			<PageHeading title="Users" />
			<p>
				Everyone in the staff directory. A portal user is only created when something
				happens for that person, such as signing in, being added to a case or being given a
				role.
			</p>
			<FilterBar label="Users">
				<TextInput
					id="q"
					name="q"
					label="Search by name, email or username"
					defaultValue={filters.search}
					type="search"
					spellCheck={false}
				/>
				<Select
					id="role"
					name="role"
					label="Role"
					defaultValue={filters.role}
					options={[
						{ value: "", label: "All roles" },
						...PORTAL_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
						{ value: "none", label: "Colleague (no role)" },
					]}
				/>
				<Select
					id="show"
					name="show"
					label="Show"
					defaultValue={filters.show}
					options={[
						{ value: "directory", label: "Everyone in the directory" },
						{ value: "portal", label: "Portal users only" },
					]}
				/>
			</FilterBar>
			<p>
				{number.format(counts.directory)} people in the directory ·{" "}
				{number.format(counts.portalUsers)} portal users · {number.format(counts.withRole)}{" "}
				with a role
			</p>
			<UsersTable
				key={JSON.stringify(filters)}
				initialRows={toTableRows(page.rows)}
				total={page.total}
				filters={filters}
			/>
		</TeamPage>
	);
}
