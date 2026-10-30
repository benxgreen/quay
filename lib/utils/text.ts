/** Small wording helpers shared by pages, emails and downloads. */

/** "1 booking", "3 bookings"; pass `many` for irregular plurals. */
export function plural(n: number, one: string, many = `${one}s`): string {
	return `${n} ${n === 1 ? one : many}`;
}

/** "a", "a and b", "a, b and c". */
export function listWords(parts: readonly string[]): string {
	if (parts.length < 2) return parts.join("");
	return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}
