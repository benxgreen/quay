import { type MarkdownBlock, type MarkdownInline, parseMarkdown } from "@/lib/markdown/parse";

/**
 * Inline styles matching the portal email template, so the message displays
 * properly in Outlook. Taken from the mockup's "HTML sent to the webhook".
 */
const FONT = "font-family: Helvetica, Arial, system-ui, sans-serif;";
const LINE_26 = "line-height: 26px; mso-line-height-rule: exactly;";

export const EMAIL_STYLES = {
	p: `font-size: 16px; ${FONT} font-weight: 400; color: #0b0c0c; margin: 0 0 20px 0; ${LINE_26}`,
	heading: `font-size: 20px; font-weight: 600; ${FONT} color: #361e54; margin: 15px 0; line-height: 28px; mso-line-height-rule: exactly;`,
	li: `font-size: 16px; ${FONT} color: #0b0c0c; ${LINE_26} margin: 10px 0; padding: 0;`,
	a: "text-decoration: underline; color: #1d70b8; font-weight: 500;",
} as const;

export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function nodeHtml(node: MarkdownInline): string {
	switch (node.type) {
		case "text":
			return escapeHtml(node.text);
		case "strong":
			return `<strong>${escapeHtml(node.text)}</strong>`;
		case "em":
			return `<em>${escapeHtml(node.text)}</em>`;
		case "break":
			return "<br>";
		case "link":
			return `<a href="${escapeHtml(node.href)}" style="${EMAIL_STYLES.a}">${escapeHtml(node.label)}</a>`;
	}
}

function inlineHtml(content: MarkdownInline[]): string {
	return content.map(nodeHtml).join("");
}

const paragraph = (html: string) => `<p style="${EMAIL_STYLES.p}">${html}</p>`;

/**
 * Emails are only paragraphs, headings, lists, bold and links, so the page-only
 * blocks fall back to those: inset text keeps its content, warning text and a
 * details summary become bold paragraphs.
 */
function blockHtml(block: MarkdownBlock): string {
	switch (block.type) {
		case "heading":
			return `<h${block.level} style="${EMAIL_STYLES.heading}">${inlineHtml(block.content)}</h${block.level}>`;
		case "paragraph":
			return paragraph(inlineHtml(block.content));
		case "list": {
			const tag = block.ordered ? "ol" : "ul";
			const start = block.ordered && block.start !== 1 ? ` start="${block.start}"` : "";
			const items = block.items.map(
				(item) => `<li style="${EMAIL_STYLES.li}">${inlineHtml(item)}</li>`,
			);
			return `<${tag}${start}>\n${items.join("\n")}\n</${tag}>`;
		}
		case "code":
			return paragraph(escapeHtml(block.text).replaceAll("\n", "<br>"));
		case "inset":
			return block.blocks.map(blockHtml).join("\n");
		case "warning":
			return paragraph(`<strong>${inlineHtml(block.content)}</strong>`);
		case "details":
			return [
				paragraph(`<strong>${escapeHtml(block.summary)}</strong>`),
				...block.blocks.map(blockHtml),
			].join("\n");
	}
}

/** The message as HTML with inline styles, for the portal email template's {content}. */
export function markdownToEmailHtml(markdown: string): string {
	return parseMarkdown(markdown).map(blockHtml).join("\n");
}
