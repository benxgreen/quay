import "server-only";

import { query, queryOne } from "@/lib/db/query";

/**
 * The portal email template (portal Settings): the HTML every service's
 * emails are placed in, at {content}, with {preheader} and {team_name}.
 */
export type PortalEmailTemplate = {
	html: string;
	updatedAt: Date | null;
	updatedBy: string | null;
};

export async function getPortalEmailTemplate(): Promise<PortalEmailTemplate> {
	const row = await queryOne<PortalEmailTemplate>(
		`SELECT t.html, t.updated_at AS "updatedAt", u.display_name AS "updatedBy"
		 FROM portal.email_template t LEFT JOIN portal.users u ON u.id = t.updated_by
		 WHERE t.id = 1`,
	);
	if (!row) throw new Error("The portal email template is missing");
	return row;
}

export async function savePortalEmailTemplate(html: string, actorId: string): Promise<void> {
	await query(
		"UPDATE portal.email_template SET html = $1, updated_by = $2, updated_at = now() WHERE id = 1",
		[html, actorId],
	);
}
