import "server-only";

import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";

/**
 * The laptop replacement Settings (spec, "Settings"): the software list,
 * page content, FAQs, session defaults, invitations and reminders, and the
 * two checklists. Removing an item only marks it inactive, so cases and
 * bookings that used it keep their record.
 */

export type SoftwareItem = { id: string; name: string; hint: string | null };
export type FaqItem = {
	id: string;
	question: string;
	answer: string;
	shownFor: ReplacementType[];
};
export type ContentItem = {
	type: ReplacementType;
	body: string;
	updatedAt: Date | null;
	updatedBy: string | null;
};
export type DefaultsItem = {
	type: ReplacementType;
	time: string;
	capacity: number;
	location: string;
};
export type ChecklistName = "device_preparation" | "decommission";
export type ChecklistItem = { id: string; label: string };

export type ServiceSettings = {
	invitationsPerWorkingDay: number;
	firstReminderAfterDays: number;
	reminderWeekday: number;
	flagAfterReminders: number;
	bookingLeadWorkingDays: number;
	softwareLockWorkingDays: number;
	returnRemindersEnabled: boolean;
	returnReminderWeekday: number;
};

export const CHECKLISTS: Record<ChecklistName, { title: string; step: number }> = {
	device_preparation: { title: "Device preparation checks", step: 1 },
	decommission: { title: "Decommission checklist", step: 5 },
};

export function isChecklistName(value: string): value is ChecklistName {
	return value in CHECKLISTS;
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

// Reading ------------------------------------------------------------------

export async function listSoftware(): Promise<SoftwareItem[]> {
	return query<SoftwareItem>(
		"SELECT id::text, name, hint FROM lr.software WHERE active ORDER BY lower(name)",
	);
}

export async function getSoftware(id: string): Promise<SoftwareItem | undefined> {
	if (!/^\d+$/.test(id)) return undefined;
	return queryOne<SoftwareItem>(
		"SELECT id::text, name, hint FROM lr.software WHERE id = $1 AND active",
		[id],
	);
}

export async function listFaqs(): Promise<FaqItem[]> {
	return query<FaqItem>(
		`SELECT id::text, question, answer_markdown AS answer, shown_for AS "shownFor"
		 FROM lr.faqs WHERE active ORDER BY sort_order, id`,
	);
}

export async function getFaq(id: string): Promise<FaqItem | undefined> {
	if (!/^\d+$/.test(id)) return undefined;
	return queryOne<FaqItem>(
		`SELECT id::text, question, answer_markdown AS answer, shown_for AS "shownFor"
		 FROM lr.faqs WHERE id = $1 AND active`,
		[id],
	);
}

export async function listContent(): Promise<ContentItem[]> {
	return query<ContentItem>(
		`SELECT p.session_type AS type, p.body_markdown AS body, p.updated_at AS "updatedAt",
		        u.display_name AS "updatedBy"
		 FROM lr.page_content p LEFT JOIN portal.users u ON u.id = p.updated_by
		 ORDER BY p.session_type DESC`,
	);
}

export async function listDefaults(): Promise<DefaultsItem[]> {
	return query<DefaultsItem>(
		`SELECT session_type AS type, to_char(start_time, 'HH24:MI') AS time, capacity, location
		 FROM lr.session_defaults ORDER BY session_type`,
	);
}

export async function listChecklist(list: ChecklistName): Promise<ChecklistItem[]> {
	return query<ChecklistItem>(
		`SELECT id::text, label FROM lr.checklist_items
		 WHERE list = $1 AND active ORDER BY sort_order, id`,
		[list],
	);
}

export async function getChecklistItem(
	list: ChecklistName,
	id: string,
): Promise<ChecklistItem | undefined> {
	if (!/^\d+$/.test(id)) return undefined;
	return queryOne<ChecklistItem>(
		"SELECT id::text, label FROM lr.checklist_items WHERE list = $1 AND id = $2 AND active",
		[list, id],
	);
}

export async function getServiceSettings(): Promise<ServiceSettings> {
	const row = await queryOne<ServiceSettings>(
		`SELECT invitations_per_working_day AS "invitationsPerWorkingDay",
		        first_reminder_after_days AS "firstReminderAfterDays",
		        reminder_weekday AS "reminderWeekday",
		        flag_after_reminders AS "flagAfterReminders",
		        booking_lead_working_days AS "bookingLeadWorkingDays",
		        software_lock_working_days AS "softwareLockWorkingDays",
		        return_reminders_enabled AS "returnRemindersEnabled",
		        return_reminder_weekday AS "returnReminderWeekday"
		 FROM lr.settings WHERE id = 1`,
	);
	if (!row) throw new Error("The laptop replacement settings are missing");
	return row;
}

// Changing -----------------------------------------------------------------

export type SaveResult = { ok: true } | { ok: false; field: string; error: string };

/**
 * Adds software, or brings back a removed name with the new hint. Names
 * are unique whatever their case.
 */
export async function addSoftware(name: string, hint: string): Promise<SaveResult> {
	const existing = await queryOne<{ id: string; active: boolean }>(
		"SELECT id::text, active FROM lr.software WHERE lower(name) = lower($1)",
		[name],
	);
	if (existing?.active) {
		return { ok: false, field: "name", error: `${name} is already on the software list` };
	}
	if (existing) {
		await query("UPDATE lr.software SET name = $2, hint = $3, active = true WHERE id = $1", [
			existing.id,
			name,
			hint || null,
		]);
	} else {
		await query("INSERT INTO lr.software (name, hint) VALUES ($1, $2)", [name, hint || null]);
	}
	return { ok: true };
}

/** Renames or re-hints software. Existing bookings keep the name they were saved with. */
export async function updateSoftware(id: string, name: string, hint: string): Promise<SaveResult> {
	const clash = await queryOne<{ id: string }>(
		"SELECT id::text FROM lr.software WHERE lower(name) = lower($1) AND id <> $2",
		[name, id],
	);
	if (clash)
		return { ok: false, field: "name", error: `${name} is already on the software list` };
	await query("UPDATE lr.software SET name = $2, hint = $3 WHERE id = $1 AND active", [
		id,
		name,
		hint || null,
	]);
	return { ok: true };
}

export async function saveFaq(
	id: string | null,
	input: { question: string; answer: string; shownFor: ReplacementType[] },
	actorId: string,
): Promise<void> {
	if (id) {
		await query(
			`UPDATE lr.faqs SET question = $2, answer_markdown = $3, shown_for = $4,
			        updated_by = $5, updated_at = now()
			 WHERE id = $1 AND active`,
			[id, input.question, input.answer, input.shownFor, actorId],
		);
		return;
	}
	await query(
		`INSERT INTO lr.faqs (question, answer_markdown, shown_for, sort_order, updated_by)
		 VALUES ($1, $2, $3, coalesce((SELECT max(sort_order) + 1 FROM lr.faqs WHERE active), 1), $4)`,
		[input.question, input.answer, input.shownFor, actorId],
	);
}

export async function savePageContent(
	type: ReplacementType,
	body: string,
	actorId: string,
): Promise<void> {
	await query(
		`INSERT INTO lr.page_content (session_type, body_markdown, updated_by, updated_at)
		 VALUES ($1, $2, $3, now())
		 ON CONFLICT (session_type)
		 DO UPDATE SET body_markdown = $2, updated_by = $3, updated_at = now()`,
		[type, body, actorId],
	);
}

export async function saveDefaults(input: DefaultsItem, actorId: string): Promise<void> {
	await query(
		`INSERT INTO lr.session_defaults (session_type, start_time, capacity, location, updated_by, updated_at)
		 VALUES ($1, $2, $3, $4, $5, now())
		 ON CONFLICT (session_type)
		 DO UPDATE SET start_time = $2, capacity = $3, location = $4, updated_by = $5, updated_at = now()`,
		[input.type, input.time, input.capacity, input.location, actorId],
	);
}

/** The settings column each number setting saves to. */
const SETTING_COLUMNS = {
	invitationsPerWorkingDay: "invitations_per_working_day",
	firstReminderAfterDays: "first_reminder_after_days",
	reminderWeekday: "reminder_weekday",
	flagAfterReminders: "flag_after_reminders",
	bookingLeadWorkingDays: "booking_lead_working_days",
	softwareLockWorkingDays: "software_lock_working_days",
	returnRemindersEnabled: "return_reminders_enabled",
	returnReminderWeekday: "return_reminder_weekday",
} as const satisfies Record<keyof ServiceSettings, string>;

export async function saveServiceSettings(
	changes: Partial<ServiceSettings>,
	actorId: string,
): Promise<void> {
	const entries = Object.entries(changes) as [keyof ServiceSettings, number | boolean][];
	if (!entries.length) return;
	const sets = entries.map(([key], index) => `${SETTING_COLUMNS[key]} = $${index + 2}`);
	await query(
		`UPDATE lr.settings SET ${sets.join(", ")}, updated_by = $1, updated_at = now() WHERE id = 1`,
		[actorId, ...entries.map(([, value]) => value)],
	);
}

export async function addChecklistItem(list: ChecklistName, label: string): Promise<void> {
	await query(
		`INSERT INTO lr.checklist_items (list, label, sort_order)
		 VALUES ($1, $2, coalesce((SELECT max(sort_order) + 1 FROM lr.checklist_items WHERE list = $1 AND active), 1))`,
		[list, label],
	);
}

export async function updateChecklistItem(
	list: ChecklistName,
	id: string,
	label: string,
): Promise<void> {
	await query("UPDATE lr.checklist_items SET label = $3 WHERE list = $1 AND id = $2 AND active", [
		list,
		id,
		label,
	]);
}

/** Things in Settings that can be removed and moved. */
export type SettingsKind = "software" | "faq" | ChecklistName;

const TABLES: Record<SettingsKind, { table: string; list?: ChecklistName }> = {
	software: { table: "lr.software" },
	faq: { table: "lr.faqs" },
	device_preparation: { table: "lr.checklist_items", list: "device_preparation" },
	decommission: { table: "lr.checklist_items", list: "decommission" },
};

export function isSettingsKind(value: string): value is SettingsKind {
	return value in TABLES;
}

/** Removes an item from its list. It stays in the database, inactive. */
export async function removeItem(kind: SettingsKind, id: string): Promise<void> {
	const { table, list } = TABLES[kind];
	await query(
		`UPDATE ${table} SET active = false WHERE id = $1${list ? " AND list = $2" : ""}`,
		list ? [id, list] : [id],
	);
}

/**
 * Moves an FAQ or checklist item one place up or down. The list is
 * renumbered 1, 2, 3… in the new order, in one transaction.
 */
export async function moveItem(
	kind: Exclude<SettingsKind, "software">,
	id: string,
	direction: "up" | "down",
): Promise<void> {
	const { table, list } = TABLES[kind];
	await withTransaction(async (tx) => {
		const rows = await query<{ id: string }>(
			`SELECT id::text FROM ${table} WHERE active${list ? " AND list = $1" : ""}
			 ORDER BY sort_order, id FOR UPDATE`,
			list ? [list] : [],
			tx,
		);
		const ids = rows.map((row) => row.id);
		const from = ids.indexOf(id);
		const to = direction === "up" ? from - 1 : from + 1;
		if (from < 0 || to < 0 || to >= ids.length) return;
		[ids[from], ids[to]] = [ids[to], ids[from]];
		for (const [index, rowId] of ids.entries()) {
			await query(
				`UPDATE ${table} SET sort_order = $2 WHERE id = $1`,
				[rowId, index + 1],
				tx,
			);
		}
	});
}
