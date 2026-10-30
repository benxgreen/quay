import type { CaseStatus } from "@/services/replacements/laptops/lib/case-status";

/** The six replacement steps, in order (spec, "Cases"). */
export const STEP_TITLES = [
	"Replacement device",
	"Device preparation",
	"Software prepared",
	"Complete replacement",
	"Old device returned",
	"Old device decommissioned",
] as const;

/** How the Cases list names the current step: "Step 4 of 6: ready to complete". */
const STEP_LABELS = [
	"replacement device",
	"device preparation",
	"software preparation",
	"ready to complete",
	"old device return",
	"decommission",
] as const;

export type CaseProgress = {
	status: CaseStatus;
	boxNumber: string | null;
	devicePreparedAt: Date | null;
	softwarePreparedAt: Date | null;
	/** Software on the active booking, or null when there is no booking. */
	softwareRequested: readonly string[] | null;
};

/**
 * The step a case is on, 1 to 6, or null once it is Completed or Withdrawn.
 * Steps 1 to 3 can be done before the person books; step 3 waits for their
 * software choice unless they asked for none. Step 4 also needs a booking,
 * which the page says when there isn't one.
 */
export function currentStep(progress: CaseProgress): number | null {
	switch (progress.status) {
		case "completed":
		case "withdrawn":
			return null;
		case "awaiting_decommission":
			return 6;
		case "awaiting_return":
			return 5;
	}
	if (!progress.boxNumber) return 1;
	if (!progress.devicePreparedAt) return 2;
	const needsSoftware =
		!progress.softwarePreparedAt &&
		(progress.softwareRequested === null || progress.softwareRequested.length > 0);
	return needsSoftware ? 3 : 4;
}

/** "Step 2 of 6: device preparation", or null for a closed case. */
export function stepLabel(progress: CaseProgress): string | null {
	const step = currentStep(progress);
	return step ? `Step ${step} of 6: ${STEP_LABELS[step - 1]}` : null;
}
