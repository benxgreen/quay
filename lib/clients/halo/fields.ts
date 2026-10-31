/** Reading a mapped Halo field. Safe in the browser, for the settings preview. */

/**
 * A mapped field's value on a Halo record as text: a custom field's value,
 * a list's names joined ("Housing, Planning"), or the property itself.
 * Null when the field isn't mapped or is empty.
 */
export function readHaloField(
	record: Record<string, unknown> & {
		customfields?: { id: number; value?: unknown; display?: unknown }[];
	},
	field: string | null,
): string | null {
	if (!field) return null;
	const custom = field.match(/^custom:(\d+)$/);
	const raw = custom
		? (record.customfields?.find((f) => f.id === Number(custom[1]))?.display ??
			record.customfields?.find((f) => f.id === Number(custom[1]))?.value)
		: record[field];
	const text = Array.isArray(raw)
		? raw
				.map((item) =>
					typeof item === "object" && item
						? String((item as { name?: unknown }).name ?? "")
						: String(item),
				)
				.filter(Boolean)
				.join(", ")
		: raw == null
			? ""
			: String(raw);
	return text.trim() || null;
}
