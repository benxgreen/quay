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

export const BOOKING_STATUSES = [
	"booked",
	"rebooked",
	"cancelled",
	"did_not_attend",
	"unsuccessful",
	"attended",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
	booked: "Booked",
	rebooked: "Rebooked",
	cancelled: "Cancelled",
	did_not_attend: "Did not attend",
	unsuccessful: "Unsuccessful",
	attended: "Attended",
};

/**
 * The mockups show Booked (green) and Rebooked (grey); the rest follow the
 * case colours: Attended turquoise, Did not attend red, Unsuccessful orange.
 */
export const BOOKING_STATUS_COLOURS: Record<BookingStatus, TagColour> = {
	booked: "green",
	rebooked: "grey",
	cancelled: "grey",
	did_not_attend: "red",
	unsuccessful: "orange",
	attended: "turquoise",
};

/** Statuses up to the replacement being completed, while booking actions apply. */
export const BEFORE_COMPLETION: readonly CaseStatus[] = [
	"queued",
	"pending",
	"unbooked",
	"booked",
	"rebook_required",
];
