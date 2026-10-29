import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";

/** New starters: its team role. */
export default async function NewStartersLayout({ children }: { children: ReactNode }) {
	await requireRole(ACCESS.newStarters);
	return children;
}
