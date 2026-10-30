import { isJobKey } from "@/services/replacements/laptops/lib/jobs";
import { runJobsForRequest } from "@/services/replacements/laptops/lib/jobs/request";

export const dynamic = "force-dynamic";

/** Runs one job, such as POST /api/replacements/laptops/jobs/invitations. */
export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) {
	const { job } = await params;
	if (!isJobKey(job)) return Response.json({ error: "No such job" }, { status: 404 });
	return runJobsForRequest(request, [job]);
}
