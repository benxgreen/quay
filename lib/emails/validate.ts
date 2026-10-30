import { findUnknownVariables, LAYOUT_PLACEHOLDERS } from "@/lib/emails/render";

/**
 * Checks for any service's email editor and the portal email template, so
 * every service refuses the same mistakes in the same words.
 */

export type EmailFields = { subject: string; preheader: string; body: string };

export const PREHEADER_MAX = 90;

/** "{dates} is not a variable…", or undefined when every variable is known. */
export function unknownVariablesMessage(
	text: string,
	known: readonly string[],
): string | undefined {
	const unknown = findUnknownVariables(text, known);
	if (!unknown.length) return undefined;
	return `${unknown.map((name) => `{${name}}`).join(", ")} ${unknown.length === 1 ? "is not a variable" : "are not variables"}. Check the spelling or remove it`;
}

/** Errors in an email's subject, preheader and message, keyed by field. */
export function checkEmailFields(
	values: EmailFields,
	knownVariables: readonly string[],
): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!values.subject) errors.subject = "Enter the subject";
	else if (values.subject.length > 200)
		errors.subject = "Subject must be 200 characters or fewer";
	if (values.preheader.length > PREHEADER_MAX) {
		errors.preheader = `Preheader must be ${PREHEADER_MAX} characters or fewer`;
	}
	if (!values.body) errors.body = "Enter the message";
	for (const name of ["subject", "preheader", "body"] as const) {
		if (errors[name]) continue;
		const problem = unknownVariablesMessage(values[name], knownVariables);
		if (problem) errors[name] = problem;
	}
	return errors;
}

/** The error in a portal email template's HTML, if any. */
export function checkTemplateHtml(html: string): string | undefined {
	if (!html.trim()) return "Enter the template HTML";
	if (!html.includes("{content}")) return "Put {content} where each email's message goes";
	const problem = unknownVariablesMessage(html, LAYOUT_PLACEHOLDERS);
	return problem
		? `${problem}. The template can only use {content}, {preheader} and {team_name}`
		: undefined;
}
