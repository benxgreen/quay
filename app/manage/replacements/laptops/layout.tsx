import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";

/** Laptop replacements: its team and admin roles. */
export default async function LaptopReplacementsLayout({ children }: { children: ReactNode }) {
	await requireRole(ACCESS.laptops);
	return children;
}
