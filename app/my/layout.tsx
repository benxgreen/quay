import type { ReactNode } from "react";
import { ColleagueLayout } from "@/components/layouts/colleague-layout";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function MyLayout({ children }: { children: ReactNode }) {
	const user = await getCurrentUser();

	return <ColleagueLayout user={user}>{children}</ColleagueLayout>;
}
