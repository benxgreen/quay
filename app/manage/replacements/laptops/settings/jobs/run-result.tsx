import { Tag } from "@/components/ui/tag";
import type { JobRun } from "@/services/replacements/laptops/lib/jobs/log";

/** A job run's outcome: always colour plus a word. */
export function RunResult({ run }: { run: JobRun }) {
	if (!run.finishedAt) return <Tag colour="blue">Running</Tag>;
	if (run.error) return <Tag colour="red">Stopped</Tag>;
	if (run.failed) return <Tag colour="orange">Some failed</Tag>;
	return <Tag colour="green">Done</Tag>;
}
