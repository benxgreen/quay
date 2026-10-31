import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";

/** portal Settings: Administrators only. */
export default async function PortalSettingsLayout({ children }: { children: ReactNode }) {
	await requireRole(ACCESS.management);
	return children;
}
