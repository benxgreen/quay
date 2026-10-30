/** Reading submitted forms on the server, the same way in every service. */

/** The named fields as trimmed strings, "" when missing. */
export function readFields(formData: FormData, names: readonly string[]): Record<string, string> {
	return Object.fromEntries(names.map((name) => [name, String(formData.get(name) ?? "").trim()]));
}

/** A whole number within limits, or the GOV.UK-style error for it. `name` is lower case, like "capacity". */
export function readWholeNumber(
	raw: string,
	{ min, max, name }: { min: number; max: number; name: string },
): { value: number } | { error: string } {
	const text = raw.trim();
	const Name = name.charAt(0).toUpperCase() + name.slice(1);
	if (!text) return { error: `Enter ${name}` };
	if (!/^\d+$/.test(text)) return { error: `${Name} must be a whole number` };
	const value = Number(text);
	if (value < min) return { error: `${Name} must be ${min} or more` };
	if (value > max) return { error: `${Name} must be ${max} or fewer` };
	return { value };
}

/** A weekday from a radio, 1 (Monday) to 5 (Friday), or null. */
export function readWeekday(raw: string): number | null {
	const day = Number(raw);
	return Number.isInteger(day) && day >= 1 && day <= 5 ? day : null;
}
