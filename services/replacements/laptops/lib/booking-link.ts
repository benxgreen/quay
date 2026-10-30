import "server-only";

import { readSignedId, signId } from "@/lib/auth/signed-id";
import { portalUrl } from "@/lib/portal/url";

/**
 * The link in laptop emails (spec, "Access"): it carries a signed case token
 * so it opens the right case, but the case is still matched on the signed-in
 * person, never on the link alone. The token never expires, so it is the
 * same for every email about a case (`lib/auth/signed-id.ts`).
 */
const LAPTOP_PAGE = "/my/replacements/laptop";

const SCOPE = "lr-case";

export function caseToken(caseId: string | number): string {
	return signId(SCOPE, caseId);
}

/** The case ID a token was made for, or null if it isn't genuine. */
export function caseFromToken(token: string | undefined): string | null {
	return readSignedId(SCOPE, token);
}

export function bookingLink(caseId: string | number): string {
	return portalUrl(`${LAPTOP_PAGE}?case=${caseToken(caseId)}`);
}
