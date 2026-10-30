"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { londonToday } from "@/lib/clock";
import { assertIsoDate } from "@/lib/dates/working-days";
import { ACCESS } from "@/lib/portal/access";
import { isJobKey, JOB_KEYS, runJobs } from "@/services/replacements/laptops/lib/jobs";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

export type RunJobsState = {
	values: { job: string; day: string; month: string; year: string };
	errors: { job?: string; date?: string };
};

/**
 * Runs the jobs on demand, in development only, optionally "as if today
 * is" another date (passed to the jobs' queries, not the database clock).
 */
export async function runJobsNow(_state: RunJobsState, formData: FormData): Promise<RunJobsState> {
	const user = await requireRole(ACCESS.laptopsSettings);
	if (process.env.NODE_ENV === "production") {
		throw new Error("Jobs can only be run on demand in development");
	}
	const f = (name: string) => String(formData.get(name) ?? "").trim();
	const values = {
		job: f("job"),
		day: f("date-day"),
		month: f("date-month"),
		year: f("date-year"),
	};
	const errors: RunJobsState["errors"] = {};

	if (values.job !== "all" && !isJobKey(values.job)) errors.job = "Select which jobs to run";

	const blank = !values.day && !values.month && !values.year;
	let day = londonToday();
	if (!blank) {
		try {
			day = assertIsoDate(
				`${values.year.padStart(4, "0")}-${values.month.padStart(2, "0")}-${values.day.padStart(2, "0")}`,
			);
		} catch {
			errors.date = "Enter a real date, or leave the date blank for today";
		}
	}
	if (errors.job || errors.date) return { values, errors };

	const keys = values.job === "all" ? JOB_KEYS : [values.job as (typeof JOB_KEYS)[number]];
	const results = await runJobs(keys, { day, asIf: !blank, userId: user.id });
	const ids = results.map((result) => result.runId).filter(Boolean);
	redirect(`${LAPTOPS_SECTIONS.settings.href}/jobs?ran=${ids.join(",")}`);
}
