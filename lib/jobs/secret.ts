import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Checks a scheduled job call: the timer (Azure Functions or similar) sends
 * `Authorization: Bearer <JOBS_SECRET>`. Returns a response to send back
 * when the call is refused, or null when it may run.
 */
export function refuseJobRequest(request: Request): Response | null {
	const secret = process.env.JOBS_SECRET;
	if (!secret) {
		return Response.json({ error: "JOBS_SECRET is not set" }, { status: 503 });
	}
	const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
	// Hashing first makes both sides the same length for timingSafeEqual.
	const digest = (value: string) => createHash("sha256").update(value).digest();
	if (!given || !timingSafeEqual(digest(given), digest(secret))) {
		return Response.json({ error: "Not allowed" }, { status: 401 });
	}
	return null;
}
