import "server-only";

import { query } from "@/lib/db/query";

/**
 * Settings › Connections: each external connection's URL (secrets stay in
 * .env) and when it was last used. Administrator users only.
 */
export type Connection = {
	key: string;
	label: string;
	/** Only the start, such as "https://prod-12.uksouth.logic.azure.com/…": the rest can carry a signature. */
	urlStart: string | null;
	lastUsedAt: Date | null;
	updatedAt: Date | null;
	updatedBy: string | null;
};

/** How much of a link is shown: the address and the first few characters of the path. */
export function linkStart(url: string): string {
	try {
		const { origin, pathname } = new URL(url);
		return `${origin}${pathname.slice(0, 8)}…`;
	} catch {
		return `${url.slice(0, 24)}…`;
	}
}

export async function listConnections(): Promise<Connection[]> {
	const rows = await query<{
		key: string;
		label: string;
		url: string | null;
		last_used_at: Date | null;
		updated_at: Date | null;
		updated_by: string | null;
	}>(
		`SELECT c.key, c.label, c.url, l.last_used_at, c.updated_at, u.display_name AS updated_by
		 FROM portal.connections c
		 LEFT JOIN portal.connection_last_used l ON l.connection = c.key
		 LEFT JOIN portal.users u ON u.id = c.updated_by
		 ORDER BY c.label`,
	);
	return rows.map((row) => ({
		key: row.key,
		label: row.label,
		urlStart: row.url ? linkStart(row.url) : null,
		lastUsedAt: row.last_used_at,
		updatedAt: row.updated_at,
		updatedBy: row.updated_by,
	}));
}

export async function saveConnectionUrl(
	key: string,
	url: string,
	actorId: string,
): Promise<boolean> {
	const rows = await query(
		`UPDATE portal.connections SET url = $2, updated_by = $3, updated_at = now()
		 WHERE key = $1 RETURNING key`,
		[key, url, actorId],
	);
	return rows.length > 0;
}

export type ConnectionLogEntry = {
	id: string;
	occurredAt: Date;
	connection: string;
	triggerKind: string;
	triggerLabel: string;
	actor: string | null;
	caseReference: string | null;
	caseName: string | null;
	outcome: "success" | "failed";
	statusCode: number | null;
	summary: string | null;
	error: string | null;
};

export type ConnectionLogFilters = { connection: string; result: string; q: string };

/** The last 7 days of calls, newest first (portal.connection_log_recent). */
export async function listConnectionLog(
	filters: ConnectionLogFilters,
): Promise<ConnectionLogEntry[]> {
	return query<ConnectionLogEntry>(
		`SELECT l.id::text, l.occurred_at AS "occurredAt", l.connection, l.trigger_kind AS "triggerKind",
		        l.trigger_label AS "triggerLabel", a.display_name AS actor,
		        c.reference AS "caseReference", p.display_name AS "caseName",
		        l.outcome, l.status_code AS "statusCode", l.summary, l.error
		 FROM portal.connection_log_recent l
		 LEFT JOIN portal.users a ON a.id = l.actor_user_id
		 LEFT JOIN lr.cases c ON c.id = l.case_id
		 LEFT JOIN portal.users p ON p.id = c.user_id
		 WHERE ($1 = '' OR l.connection = $1)
		   AND ($2 = '' OR l.outcome = $2)
		   AND ($3 = '' OR c.reference ILIKE '%' || $3 || '%' OR p.display_name ILIKE '%' || $3 || '%')
		 ORDER BY l.occurred_at DESC, l.id DESC
		 LIMIT 1000`,
		[filters.connection, filters.result, filters.q],
	);
}
