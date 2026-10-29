import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ColleagueLayout } from "@/components/layouts/colleague-layout";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { Button } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/error-summary";
import { PageHeading } from "@/components/ui/page-heading";
import { Radios } from "@/components/ui/radios";
import { WarningText } from "@/components/ui/warning-text";
import { safeReturnTo } from "@/lib/auth/constants";
import { authMode } from "@/lib/auth/session";
import { query } from "@/lib/db/query";
import { type PortalRole, ROLE_LABELS } from "@/lib/portal/roles";
import { MOCK_HALO_USERS } from "@/mocks/halo";
import { devSignIn } from "./actions";

export const metadata: Metadata = { title: "Sign in as" };

type DevSignInPageProps = { searchParams: Promise<{ returnTo?: string; error?: string }> };

/**
 * Development only, until the Entra ID app registration exists: choose a
 * mock Halo user to sign in as. Signing in then works as it will for real,
 * through the Halo lookup and the portal user upsert. /sign-in sends you
 * here in dev mode; anywhere else this page does not exist.
 */
export default async function DevSignInPage({ searchParams }: DevSignInPageProps) {
	const { returnTo, error } = await searchParams;
	if (authMode() !== "dev") notFound();
	const back = safeReturnTo(returnTo);
	const showError = error === "choose";

	const rows = await query<{ entra_object_id: string; roles: PortalRole[] }>(
		`SELECT u.entra_object_id, array_agg(r.role ORDER BY r.role) AS roles
		 FROM portal.users u JOIN portal.user_roles r ON r.user_id = u.id
		 WHERE u.entra_object_id IS NOT NULL
		 GROUP BY u.entra_object_id`,
	);
	const rolesByUser = new Map(rows.map((row) => [row.entra_object_id, row.roles]));
	const errorText = "Select who to sign in as";

	return (
		<ColleagueLayout>
			<ColleaguePage>
				<ErrorSummary errors={showError ? [{ fieldId: "user", text: errorText }] : []} />
				<PageHeading caption="Development only" title="Sign in as" />
				<WarningText>
					This replaces Microsoft sign-in until the Entra ID app registration exists. It
					cannot be used in production.
				</WarningText>
				<form action={devSignIn}>
					{back ? <input type="hidden" name="returnTo" value={back} /> : null}
					<Radios
						name="user"
						legend="Mock Halo users"
						legendSize="m"
						error={showError ? errorText : undefined}
						items={MOCK_HALO_USERS.map((user) => {
							const roles = rolesByUser.get(user.entraObjectId ?? "") ?? [];
							return {
								value: user.entraObjectId ?? "",
								label: user.displayName,
								hint: [
									`${user.jobTitle}, ${user.department}`,
									roles.length > 0
										? roles.map((role) => ROLE_LABELS[role]).join(", ")
										: null,
									user.active ? null : "Account disabled",
								]
									.filter(Boolean)
									.join(" · "),
							};
						})}
					/>
					<Button type="submit">Sign in</Button>
				</form>
			</ColleaguePage>
		</ColleagueLayout>
	);
}
