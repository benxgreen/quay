import type { EmailVariableValues } from "@/lib/emails/render";
import {
	type LaptopVariableContext,
	variableNames,
	variablesFor,
	variableValues,
} from "@/services/replacements/laptops/lib/variables";

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

/** What an email's variables are filled from (the service's shared variable context). */
export type LaptopEmailCase = Omit<LaptopVariableContext, "teamName" | "username">;

/** The variables an email can use: those in the service's list marked for emails. */
export const LAPTOP_EMAIL_VARIABLES = variablesFor("emails");

export const LAPTOP_EMAIL_VARIABLE_NAMES = variableNames("emails");

export function laptopEmailValues(
	emailCase: LaptopEmailCase,
	teamName: string,
): EmailVariableValues {
	return variableValues("emails", { ...emailCase, teamName });
}
