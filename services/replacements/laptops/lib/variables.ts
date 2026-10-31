import { formatLongDate, formatTime } from "@/lib/dates/format";
import type { IsoDate } from "@/lib/dates/working-days";
import type { EmailVariableValues } from "@/lib/emails/render";

/**
 * Every variable laptop replacements fills in, in one place: emails, the
 * colleague's page content and the audit notes written to Halo all use
 * these names, so {full_name} means the same everywhere. Each says where it
 * can be used; the editors list those and refuse any other. Adding one here
 * adds it everywhere it's allowed.
 */

/** Where a variable can be used. */
export type VariableUse = "emails" | "page" | "audit";

/** What the variables are filled from. The caller loads what it has; the rest is left out. */
export type LaptopVariableContext = {
	firstName: string;
	fullName: string;
	caseReference: string;
	type: "collection" | "session";
	/** The current booking, a session place or a custom appointment. */
	booking: { date: IsoDate; startTime: string; location: string | null } | null;
	/** The signed link to book or change their booking. */
	bookingLink: string | null;
	oldSerial: string | null;
	/** The laptop being replaced, such as Dell and Latitude 5410. */
	oldMake?: string | null;
	oldModel?: string | null;
	/** Software they asked for, sorted alphabetically. */
	software: readonly string[];
	/** The service's team name (Settings › Emails). */
	teamName?: string;
	/** Their username, once it comes from Entra ID. */
	username?: string | null;
};

export type LaptopVariable = {
	name: string;
	description: string;
	example: string;
	usedIn: readonly VariableUse[];
	value: (context: LaptopVariableContext) => string | undefined;
};

const ALL: readonly VariableUse[] = ["emails", "page", "audit"];

export const LAPTOP_VARIABLES: readonly LaptopVariable[] = [
	{
		name: "first_name",
		description: "First name of the person the case is for",
		example: "Ellie",
		usedIn: ALL,
		value: (c) => c.firstName,
	},
	{
		name: "full_name",
		description: "Full name of the person the case is for",
		example: "Ellie Ward",
		usedIn: ALL,
		value: (c) => c.fullName,
	},
	{
		name: "username",
		description:
			"Their username, such as bcp\\ellie.ward (from Entra ID, once sign-in is live)",
		example: "bcp\\ellie.ward",
		usedIn: ["page"],
		value: (c) => c.username ?? undefined,
	},
	{
		name: "case_reference",
		description: "Case reference",
		example: "LR-000128",
		usedIn: ["emails", "audit"],
		value: (c) => c.caseReference,
	},
	{
		name: "type",
		description: "Collection or session",
		example: "session",
		usedIn: ["emails", "page"],
		value: (c) => c.type,
	},
	{
		name: "date",
		description: "Date of the booking",
		example: "Tuesday 17 November",
		usedIn: ["emails", "page"],
		value: (c) => (c.booking ? formatLongDate(c.booking.date) : undefined),
	},
	{
		name: "time",
		description: "Start time of the booking",
		example: "10:00am",
		usedIn: ["emails", "page"],
		value: (c) => (c.booking ? formatTime(c.booking.startTime) : undefined),
	},
	{
		name: "location",
		description: "Where to go",
		example: "[Location], [Room]",
		usedIn: ["emails", "page"],
		value: (c) => c.booking?.location ?? undefined,
	},
	{
		name: "booking_link",
		description: "Link to book or change their booking",
		example: "Choose a new date",
		usedIn: ["emails"],
		value: (c) => c.bookingLink ?? undefined,
	},
	{
		name: "old_serial",
		description: "Serial number of the laptop being replaced",
		example: "052318874406",
		usedIn: ["emails", "audit"],
		value: (c) => c.oldSerial ?? undefined,
	},
	{
		name: "old_make",
		description: "Make of the laptop being replaced",
		example: "Dell",
		usedIn: ALL,
		value: (c) => c.oldMake ?? undefined,
	},
	{
		name: "old_model",
		description: "Model of the laptop being replaced",
		example: "Latitude 5410",
		usedIn: ALL,
		value: (c) => c.oldModel ?? undefined,
	},
	{
		name: "team_name",
		description: "The team name for this service (set in Settings)",
		example: "Desktop Infrastructure",
		usedIn: ["emails", "page"],
		value: (c) => c.teamName,
	},
	{
		name: "software_list",
		description: "Software they asked for, as a bullet list",
		example: "Adobe Acrobat Pro, Power BI",
		usedIn: ["emails"],
		value: (c) =>
			c.software.length > 0 ? c.software.map((name) => `- ${name}`).join("\n") : undefined,
	},
];

/** The variables that can be used in one place, in the list's order. */
export function variablesFor(use: VariableUse): LaptopVariable[] {
	return LAPTOP_VARIABLES.filter((variable) => variable.usedIn.includes(use));
}

/** Their names, for checking text before it's saved. */
export function variableNames(use: VariableUse): string[] {
	return variablesFor(use).map((variable) => variable.name);
}

/** What the editors list: name, description and example (safe to pass to the browser). */
export function variableList(
	use: VariableUse,
): { name: string; description: string; example: string }[] {
	return variablesFor(use).map(({ name, description, example }) => ({
		name,
		description,
		example,
	}));
}

/** The values to fill in for one place. */
export function variableValues(
	use: VariableUse,
	context: LaptopVariableContext,
): EmailVariableValues {
	return Object.fromEntries(
		variablesFor(use).map((variable) => [variable.name, variable.value(context)]),
	);
}

/** The examples, for previews. */
export function exampleVariableValues(use: VariableUse): Record<string, string> {
	return Object.fromEntries(
		variablesFor(use).map((variable) => [variable.name, variable.example]),
	);
}
