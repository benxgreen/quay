import type { ReactNode } from "react";
import { TeamLayout } from "@/components/layouts/team-layout";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import { impersonationFor } from "@/lib/portal/impersonation";
import { menuGroups } from "@/lib/portal/navigation";

/** Team pages: anyone with a role. Each area's layout narrows it further. */
export default async function ManageLayout({ children }: { children: ReactNode }) {
	const user = await requireRole(ACCESS.manage);

	return (
		<TeamLayout menu={menuGroups(user.roles)} impersonation={impersonationFor(user)}>
			{children}
		</TeamLayout>
	);
}
