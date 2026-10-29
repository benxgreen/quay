import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";

/** Users: Administrators only. */
export default async function UsersLayout({ children }: { children: ReactNode }) {
	await requireRole(ACCESS.management);
	return children;
}
