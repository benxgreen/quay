import type { ReactNode } from "react";
import { ColleagueLayout } from "@/components/layouts/colleague-layout";
import { requireUser } from "@/lib/auth/guards";

export default async function MyLayout({ children }: { children: ReactNode }) {
	const user = await requireUser();

	return <ColleagueLayout user={user}>{children}</ColleagueLayout>;
}
