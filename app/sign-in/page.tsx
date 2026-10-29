import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { safeReturnTo } from "@/lib/auth/constants";
import { authMode } from "@/lib/auth/session";
import { AutoSignIn } from "./auto-sign-in";

export const metadata: Metadata = { title: "Signing you in" };

type SignInPageProps = { searchParams: Promise<{ returnTo?: string }> };

/**
 * Where everyone is sent to sign in (mockups: AuthSigningIn). It goes
 * straight on to Microsoft; in dev mode, to the development sign-in at
 * /auth/dev instead.
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
	const back = safeReturnTo((await searchParams).returnTo);
	const query = back ? `?returnTo=${encodeURIComponent(back)}` : "";

	if (authMode() === "dev") {
		redirect(`/auth/dev${query}`);
	}

	return (
		<ColleaguePage>
			<h1 role="status">Signing you in to Quay</h1>
			<p className="bcp-secondary-text">This usually takes a few seconds.</p>
			<AutoSignIn callbackURL={`/auth/complete${query}`} />
		</ColleaguePage>
	);
}
