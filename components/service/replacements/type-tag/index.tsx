import { Tag } from "@/components/ui/tag";

export type ReplacementType = "collection" | "session";

const LABELS: Record<ReplacementType, string> = {
	collection: "Collection",
	session: "Session",
};

/**
 * Blue "Collection" or purple "Session": always colour plus the word. Use it
 * on rows and headings where it adds information; in running text write
 * "collection" or "session" instead.
 */
export function TypeTag({ type }: { type: ReplacementType }) {
	return <Tag colour={type === "collection" ? "light-blue" : "purple"}>{LABELS[type]}</Tag>;
}
