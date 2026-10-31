import "server-only";

import { londonToday } from "@/lib/clock";
import type { IsoDate } from "@/lib/dates/working-days";
import { type Queryable, query, queryOne } from "@/lib/db/query";
import { withTransaction } from "@/lib/db/transaction";
import { type ExternalFirstResult, externalFirst, type FailedCall } from "@/lib/external-first";
import { BEFORE_COMPLETION } from "@/services/replacements/laptops/lib/case-status";
import type { CaseDetail } from "@/services/replacements/laptops/lib/cases";
import { sendCaseEmail } from "@/services/replacements/laptops/lib/emails/send";
import { getLaptopHaloClient } from "@/services/replacements/laptops/lib/halo";
import { addJournalEntry, journalFailure } from "@/services/replacements/laptops/lib/journal";
import { availableDevices } from "@/services/replacements/laptops/lib/stock";

/**
 * The six replacement steps on a case (spec, "Cases"): allocate a device,
 * the preparation checks, the software, complete (Halo), the old device's
 * return (Halo) and decommission (Halo). Checklists save only when asked;
 * each save writes one journal entry. Steps 1 to 3 can be stepped back
 * until the replacement is completed.
 */

export type ChecklistName = "device_preparation" | "decommission";

export type Check = { id: string; label: string; ticked: boolean };

export type ChecklistChange = { added: string[]; removed: string[] };

export type StepData = {
	prepChecks: Check[];
	prepChange: ChecklistChange | null;
	decommissionChecks: Check[];
	decommissionChange: ChecklistChange | null;
	softwareTicked: string[];
	returnReminders: boolean;
	/** Who last saved each list, and when. */
	saved: Partial<
		Record<"device_preparation" | "decommission" | "software", { by: string; at: Date }>
	>;
};

export async function getStepData(detail: CaseDetail): Promise<StepData> {
	const [checks, items, flags, saved] = await Promise.all([
		query<{
			id: string;
			step: ChecklistName;
			box_number: string | null;
			label: string;
			ticked: boolean;
			item: number | null;
		}>(
			`SELECT id, step, box_number, label, ticked, checklist_item_id AS item
			 FROM lr.case_checks WHERE case_id = $1 ORDER BY step, sort_order`,
			[detail.id],
		),
		query<{ id: number; list: ChecklistName; label: string }>(
			"SELECT id, list, label FROM lr.checklist_items WHERE active ORDER BY list, sort_order, id",
		),
		queryOne<{ software_prepared: string[]; return_reminders: boolean }>(
			"SELECT software_prepared, return_reminders FROM lr.cases WHERE id = $1",
			[detail.id],
		),
		query<{ list: string; by: string; at: Date }>(
			`SELECT DISTINCT ON (j.data->>'list') j.data->>'list' AS list, u.display_name AS by, j.occurred_at AS at
			 FROM lr.journal_entries j JOIN portal.users u ON u.id = j.actor_user_id
			 WHERE j.case_id = $1 AND j.kind = 'checklist' AND j.data ? 'list'
			 ORDER BY j.data->>'list', j.occurred_at DESC`,
			[detail.id],
		),
	]);

	const listOf = (step: ChecklistName) =>
		checks.filter(
			(check) =>
				check.step === step &&
				(step === "decommission" || check.box_number === detail.boxNumber),
		);
	const change = (step: ChecklistName): ChecklistChange | null => {
		const copy = listOf(step);
		if (copy.length === 0) return null;
		const current = items.filter((item) => item.list === step);
		const added = current
			.filter((item) => !copy.some((check) => check.item === item.id))
			.map((item) => item.label);
		const removed = copy
			.filter((check) => !current.some((item) => item.id === check.item))
			.map((check) => check.label);
		return added.length || removed.length ? { added, removed } : null;
	};
	const toCheck = ({ id, label, ticked }: (typeof checks)[number]): Check => ({
		id,
		label,
		ticked,
	});

	return {
		prepChecks: listOf("device_preparation").map(toCheck),
		prepChange: change("device_preparation"),
		decommissionChecks: listOf("decommission").map(toCheck),
		decommissionChange: change("decommission"),
		softwareTicked: flags?.software_prepared ?? [],
		returnReminders: flags?.return_reminders ?? true,
		saved: Object.fromEntries(saved.map((row) => [row.list, { by: row.by, at: row.at }])),
	};
}

export type StepResult =
	| { ok: true }
	| { ok: false; error: string }
	| { ok: false; failure: FailedCall };

const refuse = (error: string): StepResult => ({ ok: false, error });

function canGoBack(detail: CaseDetail): boolean {
	return !detail.archived && BEFORE_COMPLETION.includes(detail.status);
}

function onStep(detail: CaseDetail, step: number): boolean {
	return !detail.archived && detail.step === step;
}

/* Step 1 -------------------------------------------------------------- */

export async function allocateDevice(
	detail: CaseDetail,
	boxNumber: string,
	actorId: string,
): Promise<StepResult> {
	if (!onStep(detail, 1) || !BEFORE_COMPLETION.includes(detail.status)) {
		return refuse("A device can’t be allocated to this case now");
	}
	const device = (await availableDevices(actorId)).find((d) => d.assetId === boxNumber);
	if (!device)
		return refuse("Select a device that is in stock and not allocated to another case");

	try {
		await withTransaction(
			async (tx) => {
				await query(
					"INSERT INTO lr.device_allocations (box_number, case_id, allocated_by) VALUES ($1, $2, $3)",
					[boxNumber, detail.id, actorId],
					tx,
				);
				await query(
					"UPDATE lr.cases SET box_number = $2 WHERE id = $1",
					[detail.id, boxNumber],
					tx,
				);
				await query(
					"SELECT lr.copy_checklist($1, 'device_preparation', $2)",
					[detail.id, boxNumber],
					tx,
				);
				await deviceJournal(
					tx,
					boxNumber,
					detail,
					actorId,
					`Allocated to ${detail.reference}, ${detail.person.name}`,
				);
				await addJournalEntry(tx, {
					caseId: detail.id,
					actor: { userId: actorId },
					kind: "allocation",
					body: `Device allocated: box number ${boxNumber} (${device.hostname})`,
				});
			},
			{ actingUserId: actorId },
		);
	} catch (error) {
		if ((error as { constraint?: string }).constraint?.includes("one_open_per")) {
			return refuse("That device has just been allocated to another case. Choose another.");
		}
		throw error;
	}
	return { ok: true };
}

/**
 * Unallocate: the box goes back to stock and the case back to step 1. The
 * preparation checks belonged to that box, so they start again on the next
 * one, and so do the software ticks, as the software must be installed on
 * the new device.
 */
export async function unallocateDevice(
	detail: CaseDetail,
	reason: string,
	actorId: string,
): Promise<StepResult> {
	if (!canGoBack(detail) || !detail.boxNumber)
		return refuse("The device can’t be unallocated now");
	const box = detail.boxNumber;
	await withTransaction(
		async (tx) => {
			await query(
				`UPDATE lr.device_allocations
				 SET removed_at = now(), removed_by = $2, outcome = 'unallocated', removed_reason = $3
				 WHERE case_id = $1 AND removed_at IS NULL`,
				[detail.id, actorId, reason || null],
				tx,
			);
			await query(
				`UPDATE lr.cases
				 SET box_number = NULL, device_prepared_at = NULL, device_prepared_by = NULL,
				     software_prepared = '{}', software_prepared_at = NULL, software_prepared_by = NULL
				 WHERE id = $1`,
				[detail.id],
				tx,
			);
			await deviceJournal(
				tx,
				box,
				detail,
				actorId,
				`Unallocated from ${detail.reference}, ${detail.person.name}${reason ? ` (${reason})` : ""}. Back in stock`,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "allocation",
				body: `Device unallocated: box number ${box}${reason ? ` (${reason})` : ""}. Back to step 1`,
			});
		},
		{ actingUserId: actorId },
	);
	return { ok: true };
}

/* Checklists (steps 2 and 6) ---------------------------------------- */

const LIST_WORDS: Record<ChecklistName, string> = {
	device_preparation: "Preparation checks",
	decommission: "Decommission checks",
};

/** Saves the ticks on one of the case's checklists. Returns how many are ticked of how many. */
async function saveTicks(
	tx: Queryable,
	detail: CaseDetail,
	list: ChecklistName,
	tickedIds: string[],
	actorId: string,
): Promise<{ done: number; total: number; changed: boolean }> {
	const rows = await query<{ id: string; label: string; ticked: boolean }>(
		`SELECT id, label, ticked FROM lr.case_checks
		 WHERE case_id = $1 AND step = $2 AND ($2 = 'decommission' OR box_number = $3)
		 ORDER BY sort_order FOR UPDATE`,
		[detail.id, list, detail.boxNumber],
		tx,
	);
	const ticked = rows.filter((row) => !row.ticked && tickedIds.includes(row.id));
	const unticked = rows.filter((row) => row.ticked && !tickedIds.includes(row.id));
	for (const row of ticked) {
		await query(
			"UPDATE lr.case_checks SET ticked = true, ticked_by = $2, ticked_at = now() WHERE id = $1",
			[row.id, actorId],
			tx,
		);
	}
	for (const row of unticked) {
		await query(
			"UPDATE lr.case_checks SET ticked = false, ticked_by = NULL, ticked_at = NULL WHERE id = $1",
			[row.id],
			tx,
		);
	}
	const done = rows.filter(
		(row) => (row.ticked && !unticked.includes(row)) || ticked.includes(row),
	).length;
	const changed = ticked.length + unticked.length > 0;
	if (changed) {
		const parts = [
			ticked.length ? `ticked ${ticked.map((row) => row.label).join(", ")}` : null,
			unticked.length ? `unticked ${unticked.map((row) => row.label).join(", ")}` : null,
		].filter(Boolean);
		await addJournalEntry(tx, {
			caseId: detail.id,
			actor: { userId: actorId },
			kind: "checklist",
			body: `${LIST_WORDS[list]} saved: ${parts.join("; ")} (${done} of ${rows.length} done)`,
			data: { list },
		});
	}
	return { done, total: rows.length, changed };
}

/** "Save preparation checks", or "Confirm device prepared" once every check is ticked. */
export async function savePreparation(
	detail: CaseDetail,
	tickedIds: string[],
	confirm: boolean,
	actorId: string,
): Promise<StepResult> {
	if (!onStep(detail, 2)) return refuse("The preparation checks can’t be changed now");
	return withTransaction(
		async (tx): Promise<StepResult> => {
			const { done, total } = await saveTicks(
				tx,
				detail,
				"device_preparation",
				tickedIds,
				actorId,
			);
			if (!confirm) return { ok: true };
			if (done < total)
				return refuse(
					"Your ticks are saved. Tick every preparation check before confirming the device is prepared.",
				);
			await query(
				"UPDATE lr.cases SET device_prepared_at = now(), device_prepared_by = $2 WHERE id = $1",
				[detail.id, actorId],
				tx,
			);
			const labels = (
				await query<{ label: string }>(
					"SELECT label FROM lr.case_checks WHERE case_id = $1 AND step = 'device_preparation' AND box_number = $2 ORDER BY sort_order",
					[detail.id, detail.boxNumber],
					tx,
				)
			).map((row) => row.label);
			await deviceJournal(
				tx,
				detail.boxNumber as string,
				detail,
				actorId,
				`Device preparation confirmed for ${detail.reference}, ${detail.person.name}: ${labels.join(", ")}`,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "checklist",
				body: `Device prepared: all ${total} checks done on box ${detail.boxNumber}`,
			});
			return { ok: true };
		},
		{ actingUserId: actorId },
	);
}

/** Step 3: "Save software", or "Confirm software prepared" once every application is ticked. */
export async function saveSoftware(
	detail: CaseDetail,
	ticked: string[],
	confirm: boolean,
	actorId: string,
): Promise<StepResult> {
	const requested = detail.booking?.software ?? [];
	if (!onStep(detail, 3) || requested.length === 0)
		return refuse("The software can’t be changed now");
	const kept = requested.filter((name) => ticked.includes(name));
	const complete = kept.length === requested.length;
	await withTransaction(
		async (tx) => {
			const before =
				(
					await queryOne<{ software_prepared: string[] }>(
						"SELECT software_prepared FROM lr.cases WHERE id = $1 FOR UPDATE",
						[detail.id],
						tx,
					)
				)?.software_prepared ?? [];
			await query(
				"UPDATE lr.cases SET software_prepared = $2 WHERE id = $1",
				[detail.id, kept],
				tx,
			);
			const added = kept.filter((name) => !before.includes(name));
			const removed = before.filter((name) => !kept.includes(name));
			if (added.length || removed.length) {
				const parts = [
					added.length ? `ticked ${added.join(", ")}` : null,
					removed.length ? `unticked ${removed.join(", ")}` : null,
				].filter(Boolean);
				await addJournalEntry(tx, {
					caseId: detail.id,
					actor: { userId: actorId },
					kind: "software",
					body: `Software saved: ${parts.join("; ")} (${kept.length} of ${requested.length} installed)`,
					data: { list: "software" },
				});
			}
			if (confirm && complete) {
				await query(
					"UPDATE lr.cases SET software_prepared_at = now(), software_prepared_by = $2 WHERE id = $1",
					[detail.id, actorId],
					tx,
				);
				await addJournalEntry(tx, {
					caseId: detail.id,
					actor: { userId: actorId },
					kind: "software",
					body: `Software prepared: ${requested.join(", ")}`,
				});
			}
		},
		{ actingUserId: actorId },
	);
	if (confirm && !complete) {
		return refuse(
			"Your ticks are saved. Tick every application before confirming the software is prepared.",
		);
	}
	return { ok: true };
}

/** Reopen step 2 or 3, keeping the ticks. Only until the replacement is completed. */
export async function reopenStep(
	detail: CaseDetail,
	step: 2 | 3,
	actorId: string,
): Promise<StepResult> {
	const done = step === 2 ? detail.progress.devicePreparedAt : detail.progress.softwarePreparedAt;
	if (!canGoBack(detail) || !done) return refuse("This step can’t be reopened now");
	await withTransaction(
		async (tx) => {
			await query(
				step === 2
					? "UPDATE lr.cases SET device_prepared_at = NULL, device_prepared_by = NULL WHERE id = $1"
					: "UPDATE lr.cases SET software_prepared_at = NULL, software_prepared_by = NULL WHERE id = $1",
				[detail.id],
				tx,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: step === 2 ? "checklist" : "software",
				body: `Step ${step} reopened (${step === 2 ? "device preparation" : "software prepared"}); ticks kept`,
			});
		},
		{ actingUserId: actorId },
	);
	return { ok: true };
}

/** Brings a started checklist up to date with Settings, keeping ticks on items that remain. */
export async function updateChecklist(
	detail: CaseDetail,
	list: ChecklistName,
	actorId: string,
): Promise<StepResult> {
	if (!onStep(detail, list === "device_preparation" ? 2 : 6))
		return refuse("This checklist can’t be changed now");
	const box = list === "device_preparation" ? detail.boxNumber : null;
	await withTransaction(
		async (tx) => {
			const copy = await query<{ id: string; item: number | null; label: string }>(
				`SELECT id, checklist_item_id AS item, label FROM lr.case_checks
				 WHERE case_id = $1 AND step = $2 AND box_number IS NOT DISTINCT FROM $3 FOR UPDATE`,
				[detail.id, list, box],
				tx,
			);
			const items = await query<{ id: number; label: string }>(
				"SELECT id, label FROM lr.checklist_items WHERE list = $1 AND active ORDER BY sort_order, id",
				[list],
				tx,
			);
			const removed = copy.filter((check) => !items.some((item) => item.id === check.item));
			const added = items.filter((item) => !copy.some((check) => check.item === item.id));
			await query(
				"DELETE FROM lr.case_checks WHERE id = ANY($1::bigint[])",
				[removed.map((r) => r.id)],
				tx,
			);
			// Move everything out of the way, then number in the Settings order.
			await query(
				"UPDATE lr.case_checks SET sort_order = sort_order + 10000 WHERE case_id = $1 AND step = $2 AND box_number IS NOT DISTINCT FROM $3",
				[detail.id, list, box],
				tx,
			);
			for (const [index, item] of items.entries()) {
				const existing = copy.find((check) => check.item === item.id);
				if (existing) {
					await query(
						"UPDATE lr.case_checks SET sort_order = $2 WHERE id = $1",
						[existing.id, index + 1],
						tx,
					);
				} else {
					await query(
						`INSERT INTO lr.case_checks (case_id, step, box_number, checklist_item_id, label, sort_order)
						 VALUES ($1, $2, $3, $4, $5, $6)`,
						[detail.id, list, box, item.id, item.label, index + 1],
						tx,
					);
				}
			}
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "checklist",
				body: `${LIST_WORDS[list]} updated to the latest list${added.length ? `: added ${added.map((a) => a.label).join(", ")}` : ""}${removed.length ? `${added.length ? ";" : ":"} removed ${removed.map((r) => r.label).join(", ")}` : ""}`,
			});
		},
		{ actingUserId: actorId },
	);
	return { ok: true };
}

/* Step 4 -------------------------------------------------------------- */

/**
 * Complete replacement: Halo first (the new device In Service). Only when
 * Halo confirms does the case move to Awaiting return. Then the person is
 * sent "Device issued"; if that email fails it is journaled with a Failed
 * tag, and the completion stands.
 */
export async function completeReplacement(
	detail: CaseDetail,
	actorId: string,
): Promise<StepResult> {
	if (!onStep(detail, 4) || detail.status !== "booked" || !detail.boxNumber || !detail.booking) {
		return refuse("The replacement can’t be completed now");
	}
	const box = detail.boxNumber;
	const booking = detail.booking;
	const trigger = { kind: "user" as const, label: "Complete replacement", actorUserId: actorId };
	const result: ExternalFirstResult<void> = await externalFirst({
		call: () =>
			getLaptopHaloClient().issueDevice(
				{
					assetId: box,
					personName: detail.person.name,
					oldSerial: detail.oldDevice.serial,
					oldMake: detail.oldDevice.make,
					oldModel: detail.oldDevice.model,
					reference: detail.reference,
					date: londonToday(),
				},
				{ trigger, caseId: detail.id },
			),
		save: async (tx) => {
			await query(
				"UPDATE lr.bookings SET status = 'attended' WHERE id = $1",
				[booking.id],
				tx,
			);
			await query(
				"UPDATE lr.cases SET status = 'awaiting_return', attended_at = now() WHERE id = $1",
				[detail.id],
				tx,
			);
			await query(
				`UPDATE lr.device_allocations SET removed_at = now(), removed_by = $2, outcome = 'issued'
				 WHERE case_id = $1 AND removed_at IS NULL`,
				[detail.id, actorId],
				tx,
			);
			await deviceJournal(
				tx,
				box,
				detail,
				actorId,
				`Issued to ${detail.person.name} (${detail.reference}) and set In Service in Halo`,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "status",
				body: `Replacement completed. Halo updated: box ${box} In Service`,
			});
		},
		actingUserId: actorId,
		recordFailure: journalFailure({
			caseId: detail.id,
			actor: { userId: actorId },
			kind: "status",
			action: "Complete replacement",
		}),
	});
	if (!result.ok) return { ok: false, failure: result.failure };

	await sendCaseEmail({
		key: "device_issued",
		caseId: detail.id,
		trigger,
		actor: { userId: actorId },
	});
	return { ok: true };
}

/* Step 5 -------------------------------------------------------------- */

export async function saveReturnReminders(
	detail: CaseDetail,
	on: boolean,
	actorId: string,
): Promise<StepResult> {
	if (!onStep(detail, 5)) return refuse("Return reminders can’t be changed now");
	await withTransaction(
		async (tx) => {
			await query(
				"UPDATE lr.cases SET return_reminders = $2 WHERE id = $1",
				[detail.id, on],
				tx,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "status",
				body: on ? "Return reminder emails turned on" : "Return reminder emails turned off",
			});
		},
		{ actingUserId: actorId },
	);
	return { ok: true };
}

/** Mark old device as returned: Halo first, then Awaiting decommission with its checklist. */
export async function markReturned(
	detail: CaseDetail,
	date: IsoDate,
	actorId: string,
): Promise<StepResult> {
	if (!onStep(detail, 5)) return refuse("The old device can’t be marked as returned now");
	if (date > londonToday()) return refuse("The date returned can’t be in the future");
	const attended = detail.progress.attendedAt;
	if (attended && date < londonToday(attended)) {
		return refuse("The date returned can’t be before the replacement was completed");
	}
	const result = await externalFirst({
		call: () =>
			getLaptopHaloClient().markOldDeviceReturned(
				{
					assetId: detail.oldDevice.assetId,
					personName: detail.person.name,
					oldSerial: detail.oldDevice.serial,
					oldMake: detail.oldDevice.make,
					oldModel: detail.oldDevice.model,
					reference: detail.reference,
					date,
				},
				{
					trigger: {
						kind: "user",
						label: "Mark old device as returned",
						actorUserId: actorId,
					},
					caseId: detail.id,
				},
			),
		save: async (tx) => {
			await query(
				`UPDATE lr.cases
				 SET status = 'awaiting_decommission', old_device_returned_by = $2,
				     old_device_returned_at = CASE WHEN $3::date = (now() AT TIME ZONE 'Europe/London')::date
				                                   THEN now() ELSE ($3::date + time '12:00') AT TIME ZONE 'Europe/London' END
				 WHERE id = $1`,
				[detail.id, actorId, date],
				tx,
			);
			await query("SELECT lr.copy_checklist($1, 'decommission')", [detail.id], tx);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "status",
				body: `Old device (asset ${detail.oldDevice.assetId}) returned on ${date}`,
			});
		},
		actingUserId: actorId,
		recordFailure: journalFailure({
			caseId: detail.id,
			actor: { userId: actorId },
			kind: "status",
			action: "Mark old device as returned",
		}),
	});
	return result.ok ? { ok: true } : { ok: false, failure: result.failure };
}

/* Step 6 -------------------------------------------------------------- */

export async function saveDecommission(
	detail: CaseDetail,
	tickedIds: string[],
	actorId: string,
): Promise<StepResult> {
	if (!onStep(detail, 6)) return refuse("The decommission checks can’t be changed now");
	await withTransaction((tx) => saveTicks(tx, detail, "decommission", tickedIds, actorId), {
		actingUserId: actorId,
	});
	return { ok: true };
}

/**
 * Decommission old device: saves the ticks, then (with every check ticked)
 * runs the decommission call. Only when it succeeds is the case Completed;
 * if it fails the ticks stay saved and nothing else changes.
 */
export async function decommission(
	detail: CaseDetail,
	tickedIds: string[],
	actorId: string,
): Promise<StepResult> {
	if (!onStep(detail, 6)) return refuse("The old device can’t be decommissioned now");
	const { done, total } = await withTransaction(
		(tx) => saveTicks(tx, detail, "decommission", tickedIds, actorId),
		{
			actingUserId: actorId,
		},
	);
	if (done < total)
		return refuse(
			"Your ticks are saved. Tick every decommission check before decommissioning the old device.",
		);

	const result = await externalFirst({
		call: () =>
			getLaptopHaloClient().decommissionDevice(
				{
					assetId: detail.oldDevice.assetId,
					serial: detail.oldDevice.serial,
					hostname: detail.oldDevice.hostname,
				},
				{
					trigger: {
						kind: "user",
						label: "Decommission old device",
						actorUserId: actorId,
					},
					caseId: detail.id,
				},
			),
		save: async (tx) => {
			await query(
				`UPDATE lr.cases
				 SET status = 'completed', decommissioned_at = now(), decommissioned_by = $2, closed_at = now()
				 WHERE id = $1`,
				[detail.id, actorId],
				tx,
			);
			await addJournalEntry(tx, {
				caseId: detail.id,
				actor: { userId: actorId },
				kind: "status",
				body: "Old device decommissioned. Replacement complete and the case is closed",
			});
		},
		actingUserId: actorId,
		recordFailure: journalFailure({
			caseId: detail.id,
			actor: { userId: actorId },
			kind: "status",
			action: "Decommission old device",
		}),
	});
	return result.ok ? { ok: true } : { ok: false, failure: result.failure };
}

async function deviceJournal(
	tx: Queryable,
	box: string,
	detail: CaseDetail,
	actorId: string,
	body: string,
) {
	await query(
		`INSERT INTO lr.device_journal (box_number, actor_user_id, kind, case_id, body)
		 VALUES ($1, $2, 'allocation', $3, $4)`,
		[box, actorId, detail.id, body],
		tx,
	);
}
