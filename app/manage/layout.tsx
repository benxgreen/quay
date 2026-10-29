import type { ReactNode } from "react";
import { TeamLayout } from "@/components/layouts/team-layout";
import { getCurrentUser } from "@/lib/auth/current-user";
import { menuGroups } from "@/lib/portal/navigation";

export default async function ManageLayout({ children }: { children: ReactNode }) {
	const user = await getCurrentUser();

	return <TeamLayout menu={menuGroups(user.roles)}>{children}</TeamLayout>;
}
