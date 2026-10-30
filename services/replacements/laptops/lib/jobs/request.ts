import "server-only";

import { resolveToday } from "@/lib/clock";
import { refuseJobRequest } from "@/lib/jobs/secret";
import { type JobKey, runJobs } from "./index";

/**
 * Runs jobs for a timer's call to a job endpoint. `?asOf=YYYY-MM-DD` runs
 * them as if today is that date, outside production only. Answers 500 when
 * any job stopped with an error, so the timer shows the failure.
 */
export async function runJobsForRequest(request: Request, keys: readonly JobKey[]) {
	const refused = refuseJobRequest(request);
	if (refused) return refused;

	const asOf = new URL(request.url).searchParams.get("asOf") ?? undefined;
	let day: string;
	try {
		day = resolveToday(asOf);
	} catch (error) {
		return Response.json({ error: (error as Error).message }, { status: 400 });
	}

	const results = await runJobs(keys, { day, asIf: Boolean(asOf) });
	const failed = results.some((result) => result.error);
	return Response.json({ day, results }, { status: failed ? 500 : 200 });
}
