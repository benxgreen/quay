import { escapeHtml, markdownToEmailHtml } from "@/lib/markdown/email-html";
import { markdownToPlainText } from "@/lib/markdown/plain-text";

/** A variable's value; undefined or "" means it has no value for this person. */
export type EmailVariableValues = Readonly<Record<string, string | undefined>>;

/**
 * "send" leaves a variable with no value blank. "test" (Send a test to me)
 * leaves it as written, such as {date}, so the editor can see what was missing.
 */
export type EmailRenderMode = "send" | "test";

const VARIABLE = /\{([a-z][a-z0-9_]*)\}/g;

/**
 * Replaces {variables} in one pass, so a value that happens to contain
 * braces is never replaced again. Names not in `values` are not variables
 * this service knows and are left as written.
 */
export function fillVariables(
	text: string,
	values: EmailVariableValues,
	mode: EmailRenderMode,
): string {
	return text.replace(VARIABLE, (written, name: string) => {
		if (!Object.hasOwn(values, name)) return written;
		const value = values[name];
		if (value) return value;
		return mode === "test" ? written : "";
	});
}

/** Variables used in the text that the service does not offer, for checking an edit before saving. */
export function findUnknownVariables(text: string, known: readonly string[]): string[] {
	const unknown = new Set<string>();
	for (const match of text.matchAll(VARIABLE)) {
		if (!known.includes(match[1])) unknown.add(match[1]);
	}
	return [...unknown];
}

/** The portal email template's own placeholders (Portal settings). */
export const LAYOUT_PLACEHOLDERS = ["content", "preheader", "team_name"] as const;

export type EmailTemplate = {
	subject: string;
	preheader: string;
	/** The Markdown message. */
	bodyMarkdown: string;
};

export type RenderedEmail = {
	subject: string;
	preheader: string;
	html: string;
	text: string;
};

type RenderEmailOptions = {
	template: EmailTemplate;
	/** The full HTML of the portal email template. */
	layoutHtml: string;
	teamName: string;
	values: EmailVariableValues;
	mode: EmailRenderMode;
};

/**
 * Renders a service's email for sending: variables filled in the subject,
 * preheader and message, the message turned into inline-styled HTML and put
 * in the portal email template, and a plain-text version from the same
 * Markdown.
 */
export function renderEmail({
	template,
	layoutHtml,
	teamName,
	values,
	mode,
}: RenderEmailOptions): RenderedEmail {
	const subject = singleLine(fillVariables(template.subject, values, mode));
	const preheader = singleLine(fillVariables(template.preheader, values, mode));
	const markdown = fillVariables(template.bodyMarkdown, values, mode);

	const layout: Record<(typeof LAYOUT_PLACEHOLDERS)[number], string> = {
		content: markdownToEmailHtml(markdown),
		preheader: escapeHtml(preheader),
		team_name: escapeHtml(teamName),
	};
	const html = layoutHtml.replace(
		/\{(content|preheader|team_name)\}/g,
		(_, name: keyof typeof layout) => layout[name],
	);

	return { subject, preheader, html, text: markdownToPlainText(markdown) };
}

/** Subjects and preheaders are one line, whatever a value contains. */
function singleLine(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}
