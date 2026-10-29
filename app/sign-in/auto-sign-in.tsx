"use client";

import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth/client";

/**
 * Sends the browser straight on to Microsoft: the portal is single sign-on
 * only, so there is no sign-in button (mockups: AuthSigningIn).
 */
export function AutoSignIn({ callbackURL }: { callbackURL: string }) {
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		authClient.signIn
			.social({ provider: "microsoft", callbackURL, errorCallbackURL: "/sign-in/error" })
			.then((result) => {
				if (result.error) window.location.assign("/sign-in/error");
			})
			.catch(() => window.location.assign("/sign-in/error"));
	}, [callbackURL]);

	return null;
}
