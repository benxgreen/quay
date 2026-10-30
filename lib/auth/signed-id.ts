import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A record ID with a signature, for links in emails that open the right
 * record (such as a laptop replacement case). The page still checks the
 * signed-in person; the token only says which record. Tokens never expire,
 * so every email about a record carries the same one. Signed with
 * CASE_LINK_SECRET (or BETTER_AUTH_SECRET). `scope` keeps one service's
 * tokens from working for another's records.
 *
 * @example
 * const token = signId("lr-case", caseId); // "123.Xy…"
 * readSignedId("lr-case", token);          // "123", or null if forged
 */
function secret(): string {
	const value = process.env.CASE_LINK_SECRET || process.env.BETTER_AUTH_SECRET;
	if (!value) throw new Error("CASE_LINK_SECRET (or BETTER_AUTH_SECRET) is not set");
	return value;
}

function sign(scope: string, id: string): string {
	return createHmac("sha256", secret()).update(`${scope}:${id}`).digest("base64url").slice(0, 32);
}

export function signId(scope: string, id: string | number): string {
	return `${id}.${sign(scope, String(id))}`;
}

/** The ID a token was made for, or null if it isn't genuine. */
export function readSignedId(scope: string, token: string | undefined): string | null {
	const match = token?.match(/^(\d+)\.([\w-]{32})$/);
	if (!match) return null;
	const expected = Buffer.from(sign(scope, match[1]));
	const given = Buffer.from(match[2]);
	return expected.length === given.length && timingSafeEqual(expected, given) ? match[1] : null;
}
