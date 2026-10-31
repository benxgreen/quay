import type { ReactNode } from "react";
import { ColleagueLayout } from "@/components/layouts/colleague-layout";
import { getCurrentUser } from "@/lib/auth/current-user";
import { impersonationFor } from "@/lib/portal/impersonation";

/** The cookies page is open to everyone, signed in or not. */
export default async function CookiesLayout({ children }: { children: ReactNode }) {
	const user = await getCurrentUser();

	return (
		<ColleagueLayout user={user} impersonation={user ? impersonationFor(user) : null}>
			{children}
		</ColleagueLayout>
	);
}
