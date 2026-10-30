import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { portalUrl } from "@/lib/portal/url";

/**
 * The link in laptop emails (spec, "Access"): it carries a signed case token
 * so it opens the right case, but the case is still matched on the signed-in
 * person, never on the link alone. The token never expires, so it is the
 * same for every email about a case: the case ID and an HMAC of it with
 * CASE_LINK_SECRET (or BETTER_AUTH_SECRET).
 */
const LAPTOP_PAGE = "/my/replacements/laptop";

function secret(): string {
	const value = process.env.CASE_LINK_SECRET || process.env.BETTER_AUTH_SECRET;
	if (!value) throw new Error("CASE_LINK_SECRET (or BETTER_AUTH_SECRET) is not set");
	return value;
}

function sign(caseId: string): string {
	return createHmac("sha256", secret())
		.update(`lr-case:${caseId}`)
		.digest("base64url")
		.slice(0, 32);
}

export function caseToken(caseId: string | number): string {
	return `${caseId}.${sign(String(caseId))}`;
}

/** The case ID a token was made for, or null if it isn't genuine. */
export function caseFromToken(token: string | undefined): string | null {
	const match = token?.match(/^(\d+)\.([\w-]{32})$/);
	if (!match) return null;
	const expected = Buffer.from(sign(match[1]));
	const given = Buffer.from(match[2]);
	return expected.length === given.length && timingSafeEqual(expected, given) ? match[1] : null;
}

export function bookingLink(caseId: string | number): string {
	return portalUrl(`${LAPTOP_PAGE}?case=${caseToken(caseId)}`);
}
