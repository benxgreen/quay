import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeReturnTo } from "@/lib/auth/constants";
import { finishSignIn } from "@/lib/auth/finish-sign-in";
import { getSignedInObjectId } from "@/lib/auth/session";

/** Where Microsoft returns to after sign-in (Better Auth's callbackURL). */
export async function GET(request: NextRequest) {
	const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
	const objectId = await getSignedInObjectId();
	if (!objectId) {
		redirect(returnTo ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : "/sign-in");
	}
	redirect(await finishSignIn(objectId, returnTo));
}
