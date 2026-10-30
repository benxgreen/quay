import type { TagColour } from "@/components/ui/tag";

export const CASE_STATUSES = [
	"queued",
	"pending",
	"unbooked",
	"booked",
	"rebook_required",
	"awaiting_return",
	"awaiting_decommission",
	"completed",
	"withdrawn",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
	queued: "Queued",
	pending: "Pending",
	unbooked: "Unbooked",
	booked: "Booked",
	rebook_required: "Rebook required",
	awaiting_return: "Awaiting return",
	awaiting_decommission: "Awaiting decommission",
	completed: "Completed",
	withdrawn: "Withdrawn",
};

/** Tag colours from the mockups (AdminCases). Withdrawn isn't shown there, so it is grey like Completed. */
export const CASE_STATUS_COLOURS: Record<CaseStatus, TagColour> = {
	queued: "grey",
	pending: "yellow",
	unbooked: "blue",
	booked: "green",
	rebook_required: "orange",
	awaiting_return: "turquoise",
	awaiting_decommission: "pink",
	completed: "grey",
	withdrawn: "grey",
};
