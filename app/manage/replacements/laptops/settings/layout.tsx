import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";

/** Laptop replacements Settings: the admin role only. */
export default async function LaptopSettingsLayout({ children }: { children: ReactNode }) {
	await requireRole(ACCESS.laptopsSettings);
	return children;
}
