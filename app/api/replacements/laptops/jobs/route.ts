import { JOB_KEYS } from "@/services/replacements/laptops/lib/jobs";
import { runJobsForRequest } from "@/services/replacements/laptops/lib/jobs/request";

export const dynamic = "force-dynamic";

/** The 9am timer: runs every laptop replacement job together, in order. */
export async function POST(request: Request) {
	return runJobsForRequest(request, JOB_KEYS);
}
