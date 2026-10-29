"use client";

import { useActionState } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Checkboxes } from "@/components/ui/checkboxes";
import { ErrorSummary } from "@/components/ui/error-summary";
import { Link } from "@/components/ui/link";
import { PORTAL_ROLES, type PortalRole, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/portal/roles";
import { type SaveRolesState, saveRoles } from "../actions";

/** The role checkboxes on a user's page (mockups: AdminUser). */
export function RolesForm({ haloUserId, roles }: { haloUserId: number; roles: PortalRole[] }) {
	const [state, action, pending] = useActionState<SaveRolesState, FormData>(
		saveRoles.bind(null, haloUserId),
		{},
	);

	return (
		<form action={action}>
			<ErrorSummary errors={state.error ? [{ fieldId: "roles", text: state.error }] : []} />
			<Checkboxes
				name="roles"
				legend={<h2 className="bcp-heading-ml">Roles</h2>}
				hint="Everyone can use the portal as a colleague. Roles give access to the management pages."
				error={state.error}
				values={roles}
				items={PORTAL_ROLES.map((role) => ({
					value: role,
					label: ROLE_LABELS[role],
					hint: ROLE_DESCRIPTIONS[role],
				}))}
			/>
			<ButtonGroup>
				<Button type="submit" aria-disabled={pending || undefined}>
					Save roles
				</Button>
				<Link href="/manage/users">Cancel</Link>
			</ButtonGroup>
		</form>
	);
}
