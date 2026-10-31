"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEV_USER_COOKIE, safeReturnTo } from "@/lib/auth/constants";
import { finishSignIn } from "@/lib/auth/finish-sign-in";
import { authMode } from "@/lib/auth/session";
import { createMockHaloUsersClient } from "@/lib/clients/halo/users";
import { MOCK_HALO_USERS } from "@/mocks/halo";

/** The development sign-in: signs in as a mock Halo user and finishes as a real sign-in does. */
export async function devSignIn(formData: FormData) {
	if (authMode() !== "dev") throw new Error("The development sign-in is switched off.");

	const objectId = String(formData.get("user") ?? "");
	const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));
	if (!MOCK_HALO_USERS.some((user) => user.entraObjectId === objectId)) {
		redirect(
			`/auth/dev?error=choose${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`,
		);
	}

	(await cookies()).set(DEV_USER_COOKIE, objectId, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
	});
	// The people listed here only exist in the mock Halo, even when HALO_CLIENT=http.
	redirect(await finishSignIn(objectId, returnTo, createMockHaloUsersClient()));
}
