import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";

/** Portal settings: Administrators only. */
export default async function PortalSettingsLayout({ children }: { children: ReactNode }) {
	await requireRole(ACCESS.management);
	return children;
}
