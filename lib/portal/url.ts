import "server-only";

/**
 * The portal's own address, for links in emails, such as
 * https://devices.services.bcpcouncil.gov.uk. PORTAL_URL, falling back to
 * BETTER_AUTH_URL (the same address).
 */
export function portalUrl(path = ""): string {
	const base = (
		process.env.PORTAL_URL ||
		process.env.BETTER_AUTH_URL ||
		"http://localhost:3000"
	).replace(/\/+$/, "");
	return `${base}${path}`;
}
