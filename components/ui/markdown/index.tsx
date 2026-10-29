import "./markdown.css";

import type { ReactNode } from "react";
import { Details } from "@/components/ui/details";
import { InsetText } from "@/components/ui/inset-text";
import { Link } from "@/components/ui/link";
import { WarningText } from "@/components/ui/warning-text";
import { type MarkdownBlock, type MarkdownInline, parseMarkdown } from "@/lib/markdown/parse";

function renderNode(node: MarkdownInline, index: number): ReactNode {
	const key = `md-inline-${index}`;
	switch (node.type) {
		case "text":
			return node.text;
		case "strong":
			return <strong key={key}>{node.text}</strong>;
		case "em":
			return <em key={key}>{node.text}</em>;
		case "break":
			return <br key={key} />;
		case "link":
			return (
				<Link key={key} href={node.href}>
					{node.label}
				</Link>
			);
	}
}

function renderInline(content: MarkdownInline[]): ReactNode[] {
	return content.map(renderNode);
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
	const key = `md-block-${index}`;
	switch (block.type) {
		case "heading": {
			const Heading = `h${block.level}` as const;
			return <Heading key={key}>{renderInline(block.content)}</Heading>;
		}
		case "paragraph":
			return <p key={key}>{renderInline(block.content)}</p>;
		case "list": {
			const items = block.items.map((item, itemIndex) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: list items have no other identity
				<li key={itemIndex}>{renderInline(item)}</li>
			));
			return block.ordered ? (
				<ol key={key} start={block.start === 1 ? undefined : block.start}>
					{items}
				</ol>
			) : (
				<ul key={key}>{items}</ul>
			);
		}
		case "code":
			return (
				<pre key={key} className="bcp-markdown-code">
					<code>{block.text}</code>
				</pre>
			);
		case "inset":
			return <InsetText key={key}>{block.blocks.map(renderBlock)}</InsetText>;
		case "warning":
			return <WarningText key={key}>{renderInline(block.content)}</WarningText>;
		case "details":
			return (
				<Details key={key} summary={block.summary}>
					{block.blocks.map(renderBlock)}
				</Details>
			);
	}
}

/** Markdown as elements, without the wrapper, for use inside another component. */
export function MarkdownText({ markdown }: { markdown: string }) {
	return <>{parseMarkdown(markdown).map(renderBlock)}</>;
}

/**
 * Content the team writes in Markdown, such as the portal content under a
 * colleague's booking or an FAQ answer. The same Markdown makes the email
 * HTML and plain text (lib/markdown). Ported from Harbour.
 *
 * @example
 * <Markdown>{"## Before your session\n\nBring your laptop and its charger."}</Markdown>
 */
export function Markdown({ children }: { children: ReactNode }) {
	return (
		<div className="bcp-markdown">
			{typeof children === "string" ? (
				children.trim() ? (
					<MarkdownText markdown={children} />
				) : null
			) : (
				children
			)}
		</div>
	);
}
