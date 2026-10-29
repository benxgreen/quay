import { formatLongDate, formatTime } from "@/lib/dates/format";
import type { IsoDate } from "@/lib/dates/working-days";
import type { EmailVariableValues } from "@/lib/emails/render";

/**
 * The emails laptop replacements sends, in the order the Settings page lists
 * them. Keys match lr.email_templates.key and lr.email_sends.email_key.
 */
export const LAPTOP_EMAILS = [
	{
		key: "invitation",
		name: "Invitation",
		sentWhen: "Sent by the send invitations job, with the method and a link to book.",
		timing: { kind: "automatic" },
	},
	{
		key: "booking_reminder",
		name: "Booking reminder",
		sentWhen: "Sent each week until the person books.",
		timing: { kind: "setting", setting: "First reminder" },
	},
	{
		key: "booking_confirmed",
		name: "Booking confirmation",
		sentWhen:
			"Sent when a booking is made or changed, including a rebook, a custom appointment and booking on behalf.",
		timing: { kind: "automatic" },
	},
	{
		key: "session_reminder",
		name: "Session reminder",
		sentWhen: "Sent before the session, when software is locked.",
		timing: { kind: "setting", setting: "Software lock" },
	},
	{
		key: "session_cancelled",
		name: "Session cancelled",
		sentWhen: "Sent to everyone booked on a session when the team cancels it.",
		timing: { kind: "automatic" },
	},
	{
		key: "rebook_needed",
		name: "Rebook needed",
		sentWhen:
			"Sent when the team cancels a booking or marks it did not attend or unsuccessful, then each week until rebooked.",
		timing: { kind: "automatic" },
	},
	{
		key: "availability_received",
		name: "Availability request received",
		sentWhen: "Sent when the person tells us when they are available.",
		timing: { kind: "automatic" },
	},
	{
		key: "device_issued",
		name: "Device issued",
		sentWhen: "Sent when the Halo completion update succeeds.",
		timing: { kind: "automatic" },
	},
	{
		key: "return_reminder",
		name: "Old device return reminder",
		sentWhen: "Sent each week while the case is awaiting return.",
		timing: { kind: "setting", setting: "Old device return reminders" },
	},
] as const satisfies readonly {
	key: string;
	name: string;
	sentWhen: string;
	timing: { kind: "automatic" } | { kind: "setting"; setting: string };
}[];

export type LaptopEmailKey = (typeof LAPTOP_EMAILS)[number]["key"];

/** What the variables are filled from. The caller loads it from the case and its booking. */
export type LaptopEmailCase = {
	firstName: string;
	fullName: string;
	caseReference: string;
	type: "collection" | "session";
	/** The current booking, a session place or a custom appointment. */
	booking: { date: IsoDate; startTime: string; location: string | null } | null;
	/** The signed link to book or change their booking. */
	bookingLink: string | null;
	oldSerial: string | null;
	/** Software they asked for, sorted alphabetically. */
	software: readonly string[];
};

type LaptopEmailVariable = {
	name: string;
	description: string;
	example: string;
	value: (emailCase: LaptopEmailCase, teamName: string) => string | undefined;
};

/**
 * Every variable a laptop replacement email can use, listed on each email's
 * page. Adding one here makes it appear on the page.
 */
export const LAPTOP_EMAIL_VARIABLES: readonly LaptopEmailVariable[] = [
	{
		name: "first_name",
		description: "First name of the person the case is for",
		example: "Ellie",
		value: (c) => c.firstName,
	},
	{
		name: "full_name",
		description: "Full name",
		example: "Ellie Ward",
		value: (c) => c.fullName,
	},
	{
		name: "case_reference",
		description: "Case reference",
		example: "LR-000128",
		value: (c) => c.caseReference,
	},
	{
		name: "type",
		description: "Collection or session",
		example: "session",
		value: (c) => c.type,
	},
	{
		name: "date",
		description: "Date of the booking",
		example: "Tuesday 17 November",
		value: (c) => (c.booking ? formatLongDate(c.booking.date) : undefined),
	},
	{
		name: "time",
		description: "Start time of the booking",
		example: "10am",
		value: (c) => (c.booking ? formatTime(c.booking.startTime) : undefined),
	},
	{
		name: "location",
		description: "Where to go",
		example: "[Location], [Room]",
		value: (c) => c.booking?.location ?? undefined,
	},
	{
		name: "booking_link",
		description: "Link to book or change their booking",
		example: "Choose a new date",
		value: (c) => c.bookingLink ?? undefined,
	},
	{
		name: "old_serial",
		description: "Serial number of the laptop being replaced",
		example: "052318874406",
		value: (c) => c.oldSerial ?? undefined,
	},
	{
		name: "team_name",
		description: "The team name for this service (set in Settings)",
		example: "Desktop Infrastructure",
		value: (_, teamName) => teamName,
	},
	{
		name: "software_list",
		description: "Software they asked for, as a bullet list",
		example: "Adobe Acrobat Pro, Power BI",
		value: (c) =>
			c.software.length > 0 ? c.software.map((name) => `- ${name}`).join("\n") : undefined,
	},
];

export const LAPTOP_EMAIL_VARIABLE_NAMES = LAPTOP_EMAIL_VARIABLES.map((variable) => variable.name);

export function laptopEmailValues(
	emailCase: LaptopEmailCase,
	teamName: string,
): EmailVariableValues {
	return Object.fromEntries(
		LAPTOP_EMAIL_VARIABLES.map((variable) => [
			variable.name,
			variable.value(emailCase, teamName),
		]),
	);
}
