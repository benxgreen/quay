import { type MarkdownBlock, type MarkdownInline, parseMarkdown } from "@/lib/markdown/parse";

function nodeText(node: MarkdownInline): string {
	switch (node.type) {
		case "text":
		case "strong":
		case "em":
			return node.text;
		case "break":
			return "\n";
		case "link":
			return node.label === node.href ? node.href : `${node.label} (${node.href})`;
	}
}

function inlineText(content: MarkdownInline[]): string {
	return content.map(nodeText).join("");
}

function blockText(block: MarkdownBlock): string {
	switch (block.type) {
		case "heading":
		case "paragraph":
		case "warning":
			return inlineText(block.content);
		case "list":
			return block.items
				.map(
					(item, index) =>
						`${block.ordered ? `${block.start + index}.` : "-"} ${inlineText(item)}`,
				)
				.join("\n");
		case "code":
			return block.text;
		case "inset":
			return block.blocks.map(blockText).join("\n\n");
		case "details":
			return [block.summary, ...block.blocks.map(blockText)].join("\n\n");
	}
}

/**
 * The plain-text version of an email, made from the same Markdown, for email
 * apps that do not show HTML. Links show their address in brackets.
 */
export function markdownToPlainText(markdown: string): string {
	return parseMarkdown(markdown).map(blockText).join("\n\n");
}
