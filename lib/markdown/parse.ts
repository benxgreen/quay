/**
 * The portal's Markdown, parsed once and rendered three ways: as page content
 * (components/ui/markdown), as inline-styled email HTML and as plain text
 * (lib/markdown/email-html.ts, lib/markdown/plain-text.ts).
 *
 * Ported from Harbour's components/ui/markdown/render.tsx. It supports the
 * same small set: headings, paragraphs, bulleted and numbered lists, bold,
 * italic, links, code blocks, and Harbour's custom blocks:
 *
 *   ^Inset text^
 *   %Warning text%
 *   ~Details summary
 *   Hidden content~
 *
 * Differences from Harbour (see docs/design-differences.md): consecutive
 * lines join into one paragraph and a line ending in two spaces is a line
 * break, as in standard Markdown; links are only kept for safe addresses;
 * Harbour's `|` call-to-action block is not supported.
 */

export type MarkdownInline =
	| { type: "text"; text: string }
	| { type: "strong"; text: string }
	| { type: "em"; text: string }
	| { type: "link"; label: string; href: string }
	| { type: "break" };

export type MarkdownBlock =
	| { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; content: MarkdownInline[] }
	| { type: "paragraph"; content: MarkdownInline[] }
	| { type: "list"; ordered: boolean; start: number; items: MarkdownInline[][] }
	| { type: "code"; text: string }
	| { type: "inset"; blocks: MarkdownBlock[] }
	| { type: "warning"; content: MarkdownInline[] }
	| { type: "details"; summary: string; blocks: MarkdownBlock[] };

const INLINE_PATTERN = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;

/** Web, email and phone links, and links within the portal. Anything else is shown as text. */
export function isSafeHref(href: string): boolean {
	return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href.trim());
}

export function parseInline(text: string): MarkdownInline[] {
	const nodes: MarkdownInline[] = [];
	let lastIndex = 0;

	const pushText = (value: string) => {
		if (!value) return;
		const previous = nodes.at(-1);
		if (previous?.type === "text") {
			previous.text += value;
		} else {
			nodes.push({ type: "text", text: value });
		}
	};

	for (const match of text.matchAll(INLINE_PATTERN)) {
		const token = match[0];
		const index = match.index ?? 0;
		pushText(text.slice(lastIndex, index));

		if (token.startsWith("[")) {
			const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
			if (link && isSafeHref(link[2])) {
				nodes.push({ type: "link", label: link[1], href: link[2].trim() });
			} else {
				pushText(link ? link[1] : token);
			}
		} else if (token.startsWith("**")) {
			nodes.push({ type: "strong", text: token.slice(2, -2) });
		} else {
			nodes.push({ type: "em", text: token.slice(1, -1) });
		}

		lastIndex = index + token.length;
	}

	pushText(text.slice(lastIndex));
	return nodes;
}

/** Joins a paragraph's lines: a line ending in two spaces (or a backslash) is a line break. */
function parseParagraph(lines: string[]): MarkdownInline[] {
	const content: MarkdownInline[] = [];
	lines.forEach((line, index) => {
		const hardBreak = / {2,}$|\\$/.test(line);
		const text = line.trim().replace(/\\$/, "");
		content.push(...parseInline(text));
		if (index < lines.length - 1) {
			content.push(hardBreak ? { type: "break" } : { type: "text", text: " " });
		}
	});
	return mergeText(content);
}

function mergeText(nodes: MarkdownInline[]): MarkdownInline[] {
	const merged: MarkdownInline[] = [];
	for (const node of nodes) {
		const previous = merged.at(-1);
		if (node.type === "text" && previous?.type === "text") {
			previous.text += node.text;
		} else {
			merged.push(node.type === "text" ? { ...node } : node);
		}
	}
	return merged;
}

type CustomBlock = { hasTitle?: boolean };

// A line starting with the character opens the block; a line ending with the
// same character (possibly the same line) closes it.
const CUSTOM_BLOCKS: Record<string, CustomBlock> = {
	"^": {},
	"%": {},
	"~": { hasTitle: true },
};

function findBlockEnd(lines: string[], startIndex: number, delimiter: string): number {
	for (let i = startIndex; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		const minLength = i === startIndex ? 2 : 1;
		if (trimmed.endsWith(delimiter) && trimmed.length >= minLength) {
			return i;
		}
	}
	return -1;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^(?:([*+-])|(\d+)\.)\s+(.*)$/;

export function parseMarkdown(markdown: string): MarkdownBlock[] {
	const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
	const blocks: MarkdownBlock[] = [];
	let paragraph: string[] = [];
	let list: Extract<MarkdownBlock, { type: "list" }> | null = null;

	const flush = () => {
		if (paragraph.length > 0) {
			blocks.push({ type: "paragraph", content: parseParagraph(paragraph) });
			paragraph = [];
		}
		if (list) {
			blocks.push(list);
			list = null;
		}
	};

	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		const trimmed = line.trim();

		if (!trimmed) {
			flush();
			index++;
			continue;
		}

		if (trimmed.startsWith("```")) {
			flush();
			let closeIndex = lines.findIndex((other, i) => i > index && other.trim() === "```");
			if (closeIndex === -1) closeIndex = lines.length;
			blocks.push({ type: "code", text: lines.slice(index + 1, closeIndex).join("\n") });
			index = closeIndex + 1;
			continue;
		}

		const delimiter = Object.keys(CUSTOM_BLOCKS).find(
			(char) => trimmed.startsWith(char) && trimmed.length > 1,
		);
		const endIndex = delimiter ? findBlockEnd(lines, index, delimiter) : -1;
		if (delimiter && endIndex !== -1) {
			flush();
			const blockLines = lines.slice(index, endIndex + 1);
			if (blockLines.length === 1) {
				blockLines[0] = blockLines[0].trim().slice(1, -1);
			} else {
				blockLines[0] = blockLines[0].trim().slice(1);
				blockLines[blockLines.length - 1] = blockLines[blockLines.length - 1]
					.trim()
					.slice(0, -1);
			}
			const title = CUSTOM_BLOCKS[delimiter].hasTitle
				? (blockLines.shift()?.trim() ?? "")
				: "";
			const content = blockLines.join("\n").trim();

			if (delimiter === "^") {
				blocks.push({ type: "inset", blocks: parseMarkdown(content) });
			} else if (delimiter === "%") {
				blocks.push({ type: "warning", content: parseParagraph(content.split("\n")) });
			} else {
				blocks.push({ type: "details", summary: title, blocks: parseMarkdown(content) });
			}
			index = endIndex + 1;
			continue;
		}

		const heading = trimmed.match(HEADING);
		if (heading) {
			flush();
			blocks.push({
				type: "heading",
				level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
				content: parseInline(heading[2].trim()),
			});
			index++;
			continue;
		}

		const item = trimmed.match(LIST_ITEM);
		if (item) {
			const ordered = item[2] !== undefined;
			if (paragraph.length > 0 || (list && list.ordered !== ordered)) flush();
			list ??= { type: "list", ordered, start: ordered ? Number(item[2]) : 1, items: [] };
			list.items.push(parseInline(item[3].trim()));
			index++;
			continue;
		}

		if (list) flush();
		paragraph.push(line);
		index++;
	}

	flush();
	return blocks;
}
