import { Tag, type TagColour } from "@/components/ui/tag";
import {
	BOOKING_STATUS_COLOURS,
	BOOKING_STATUS_LABELS,
	type BookingStatus,
	CASE_STATUS_COLOURS,
	CASE_STATUS_LABELS,
	type CaseStatus,
} from "@/services/replacements/laptops/lib/case-status";

export type SessionStatus = "open" | "full" | "closed" | "cancelled";

/**
 * Session statuses as the mockups colour them: green Open, red Full, grey
 * Cancelled. Closed is not shown in the mockups, so it is grey too.
 */
const SESSION: Record<SessionStatus, { label: string; colour: TagColour }> = {
	open: { label: "Open", colour: "green" },
	full: { label: "Full", colour: "red" },
	closed: { label: "Closed", colour: "grey" },
	cancelled: { label: "Cancelled", colour: "grey" },
};

export function SessionStatusTag({ status }: { status: SessionStatus }) {
	return <Tag colour={SESSION[status].colour}>{SESSION[status].label}</Tag>;
}

export function CaseStatusTag({ status }: { status: CaseStatus }) {
	return <Tag colour={CASE_STATUS_COLOURS[status]}>{CASE_STATUS_LABELS[status]}</Tag>;
}

export function BookingStatusTag({ status }: { status: BookingStatus }) {
	return <Tag colour={BOOKING_STATUS_COLOURS[status]}>{BOOKING_STATUS_LABELS[status]}</Tag>;
}

export type StockStatus = "available" | "allocated" | "issued" | "not_in_stock";

/** A replacement device: Allocated is light blue in the mockups; Available green; Issued grey. */
const STOCK: Record<StockStatus, { label: string; colour: TagColour }> = {
	available: { label: "Available", colour: "green" },
	allocated: { label: "Allocated", colour: "light-blue" },
	issued: { label: "Issued", colour: "grey" },
	not_in_stock: { label: "Not in stock", colour: "grey" },
};

export function StockStatusTag({ status }: { status: StockStatus }) {
	return <Tag colour={STOCK[status].colour}>{STOCK[status].label}</Tag>;
}
