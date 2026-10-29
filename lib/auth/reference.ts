import { randomInt } from "node:crypto";

// No 0/O, 1/I/L or 5/S, so a reference read out over the phone is unambiguous.
const ALPHABET = "234679ABCDEFGHJKMNPQRTUVWXYZ";

/**
 * A short reference such as "7F3K-92QD", shown on "We could not sign you
 * in" and written to the server log with the reason, so the Modern
 * Workplace team can find what went wrong.
 */
export function newReference(): string {
	const part = () =>
		Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
	return `${part()}-${part()}`;
}

export function isReference(value: string | undefined): value is string {
	return /^[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(value ?? "");
}
