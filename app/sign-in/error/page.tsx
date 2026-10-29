import type { Metadata } from "next";
import { ColleaguePage } from "@/components/layouts/colleague-page";
import { Button } from "@/components/ui/button";
import { isReference, newReference } from "@/lib/auth/reference";

export const metadata: Metadata = { title: "We could not sign you in" };

type SignInErrorPageProps = { searchParams: Promise<{ ref?: string; error?: string }> };

/**
 * Mockups: AuthError. The reference comes from /auth/complete, which has
 * already logged the reason; an error straight from Microsoft or Better Auth
 * (`?error=`) is logged here with a new reference.
 */
export default async function SignInErrorPage({ searchParams }: SignInErrorPageProps) {
	const { ref, error } = await searchParams;
	let reference = ref;
	if (!isReference(reference)) {
		reference = newReference();
		console.error("Sign-in failed", { reference, error: error ?? "unknown" });
	}

	return (
		<ColleaguePage>
			<h1>We could not sign you in</h1>
			<p>Something went wrong when signing you in with your BCP Council account.</p>
			<p>You can try again. If it keeps happening, contact the Modern Workplace team.</p>
			<p>
				<Button href="/sign-in">Try again</Button>
			</p>
			<p className="bcp-body-small bcp-secondary-text">Reference: {reference}</p>
		</ColleaguePage>
	);
}
