import type { ReactNode } from "react";
import { ColleagueLayout } from "@/components/layouts/colleague-layout";

/** Signing in and its errors: the colleague frame with nobody signed in yet. */
export default function SignInLayout({ children }: { children: ReactNode }) {
	return <ColleagueLayout>{children}</ColleagueLayout>;
}
