"use client";

import { useActionState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { ErrorSummary } from "@/components/ui/error-summary";
import { PendingButton } from "@/components/ui/pending-button";
import { Select } from "@/components/ui/select";
import { type RunJobsState, runJobsNow } from "./actions";

const INITIAL: RunJobsState = {
	values: { job: "all", day: "", month: "", year: "" },
	errors: {},
};

/** Development only: run the jobs now, optionally as if today is another date. */
export function RunForm({ jobs }: { jobs: { key: string; name: string }[] }) {
	const [state, action] = useActionState(runJobsNow, INITIAL);
	const { values, errors } = state;
	const summary = [
		errors.job && { fieldId: "job", text: errors.job },
		errors.date && { fieldId: "date-day", text: errors.date },
	].filter((item): item is { fieldId: string; text: string } => Boolean(item));

	return (
		<form action={action} key={JSON.stringify(values)}>
			<ErrorSummary errors={summary} />
			<Select
				id="job"
				name="job"
				label="Jobs"
				error={errors.job}
				defaultValue={values.job}
				options={[
					{ value: "all", label: "All the 9:00am jobs" },
					...jobs.map((job) => ({ value: job.key, label: job.name })),
				]}
			/>
			<DateInput
				name="date"
				legend="Run as if today is (optional)"
				legendSize="s"
				hint="Leave blank for today. For example, 9 11 2026"
				error={errors.date}
				value={{ day: values.day, month: values.month, year: values.year }}
			/>
			<PendingButton variant="secondary" pendingText="Running jobs…">
				Run jobs
			</PendingButton>
		</form>
	);
}
