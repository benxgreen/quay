import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";

/** Smartphone replacements: its team and admin roles. */
export default async function SmartphoneReplacementsLayout({ children }: { children: ReactNode }) {
	await requireRole(ACCESS.smartphones);
	return children;
}
