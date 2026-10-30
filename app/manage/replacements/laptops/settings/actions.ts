"use server";

import { redirect } from "next/navigation";
import type { ReplacementType } from "@/components/service/replacements/type-tag";
import { requireRole } from "@/lib/auth/guards";
import type { FormState } from "@/lib/forms/state";
import { ACCESS, canAccess } from "@/lib/portal/access";
import {
	addChecklistItem,
	addSoftware,
	type ChecklistName,
	isChecklistName,
	isSettingsKind,
	moveItem,
	removeItem,
	saveDefaults,
	saveFaq,
	savePageContent,
	saveServiceSettings,
	updateChecklistItem,
	updateSoftware,
} from "@/services/replacements/laptops/lib/settings";
import { isNumberSetting, NUMBER_SETTINGS, readWholeNumber, SETTINGS } from "./definitions";

/** What a settings form gets back when something needs correcting. */
export type SettingsFormState = FormState;

function fields(formData: FormData, names: string[]): Record<string, string> {
	return Object.fromEntries(names.map((name) => [name, String(formData.get(name) ?? "").trim()]));
}

function done(saved: string, anchor: string): never {
	redirect(`${SETTINGS}?saved=${saved}#${anchor}`);
}

async function requireSettings() {
	return requireRole(ACCESS.laptopsSettings);
}

/** Invitations and reminders: Administrator users only (spec, "Settings"). */
async function requireAdministrator() {
	const user = await requireSettings();
	if (!canAccess(user.roles, ACCESS.management)) redirect(SETTINGS);
	return user;
}

function isType(value: string): value is ReplacementType {
	return value === "collection" || value === "session";
}

// Software list ------------------------------------------------------------

function checkSoftware(values: Record<string, string>): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!values.name) errors.name = "Enter the name of the software";
	else if (values.name.length > 100)
		errors.name = "Software name must be 100 characters or fewer";
	if (values.hint.length > 300) errors.hint = "Hint must be 300 characters or fewer";
	return errors;
}

export async function addSoftwareAction(
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	await requireSettings();
	const values = fields(formData, ["name", "hint"]);
	const errors = checkSoftware(values);
	if (Object.keys(errors).length) return { values, errors };
	const result = await addSoftware(values.name, values.hint);
	if (!result.ok) return { values, errors: { [result.field]: result.error } };
	done("software-added", "software");
}

export async function editSoftwareAction(
	id: string,
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	await requireSettings();
	const values = fields(formData, ["name", "hint"]);
	const errors = checkSoftware(values);
	if (Object.keys(errors).length) return { values, errors };
	const result = await updateSoftware(id, values.name, values.hint);
	if (!result.ok) return { values, errors: { [result.field]: result.error } };
	done("software-saved", "software");
}

// Frequently asked questions -----------------------------------------------

export async function saveFaqAction(
	id: string | null,
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	const user = await requireSettings();
	const values = fields(formData, ["question", "answer"]);
	const shownFor = formData.getAll("shownFor").map(String).filter(isType);
	values.shownFor = shownFor.join(",");
	const errors: Record<string, string> = {};
	if (!values.question) errors.question = "Enter the question";
	else if (values.question.length > 200)
		errors.question = "Question must be 200 characters or fewer";
	if (!values.answer) errors.answer = "Enter the answer";
	if (!shownFor.length) errors.shownFor = "Select who the question is shown to";
	if (Object.keys(errors).length) return { values, errors };
	await saveFaq(id, { question: values.question, answer: values.answer, shownFor }, user.id);
	done(id ? "faq-saved" : "faq-added", "faqs");
}

// Portal content -----------------------------------------------------------

export async function saveContentAction(
	type: ReplacementType,
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	const user = await requireSettings();
	const values = fields(formData, ["body"]);
	if (formData.get("intent") === "preview") return { values, errors: {}, preview: true };
	if (!values.body) return { values, errors: { body: "Enter the page content" } };
	await savePageContent(type, values.body, user.id);
	done("content", "page");
}

// Session defaults ---------------------------------------------------------

export async function saveDefaultsAction(
	type: ReplacementType,
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	const user = await requireSettings();
	const values = fields(formData, ["time-hour", "time-minute", "capacity", "location"]);
	const errors: Record<string, string> = {};
	const hour = Number(values["time-hour"]);
	const minute = Number(values["time-minute"]);
	if (
		!/^\d{1,2}$/.test(values["time-hour"]) ||
		!/^\d{1,2}$/.test(values["time-minute"]) ||
		hour > 23 ||
		minute > 59
	) {
		errors.time = "Enter a real start time, using the 24-hour clock";
	}
	const capacity = readWholeNumber(values.capacity, { min: 1, max: 200, name: "capacity" });
	if ("error" in capacity) errors.capacity = capacity.error;
	if (!values.location) errors.location = "Enter the location";
	else if (values.location.length > 200)
		errors.location = "Location must be 200 characters or fewer";
	if (Object.keys(errors).length || "error" in capacity) return { values, errors };
	await saveDefaults(
		{
			type,
			time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
			capacity: capacity.value,
			location: values.location,
		},
		user.id,
	);
	done("defaults", "defaults");
}

// Invitations and reminders ------------------------------------------------

export async function saveNumberSettingAction(
	slug: string,
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	const user = await requireAdministrator();
	if (!isNumberSetting(slug)) redirect(SETTINGS);
	const setting = NUMBER_SETTINGS[slug];
	const values = fields(formData, ["value"]);
	const read = readWholeNumber(values.value, {
		min: setting.min,
		max: setting.max,
		name: setting.title.toLowerCase(),
	});
	if ("error" in read) return { values, errors: { value: read.error } };
	await saveServiceSettings({ [setting.key]: read.value }, user.id);
	done("setting", "invites");
}

function readWeekday(raw: string): number | null {
	const day = Number(raw);
	return Number.isInteger(day) && day >= 1 && day <= 5 ? day : null;
}

export async function saveReminderAction(
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	const user = await requireAdministrator();
	const values = fields(formData, ["days", "weekday"]);
	const errors: Record<string, string> = {};
	const days = readWholeNumber(values.days, { min: 0, max: 90, name: "the number of days" });
	if ("error" in days) errors.days = days.error;
	const weekday = readWeekday(values.weekday);
	if (!weekday) errors.weekday = "Select the day reminders are sent";
	if ("error" in days || !weekday) return { values, errors };
	await saveServiceSettings(
		{ firstReminderAfterDays: days.value, reminderWeekday: weekday },
		user.id,
	);
	done("setting", "invites");
}

export async function saveReturnRemindersAction(
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	const user = await requireAdministrator();
	const values = fields(formData, ["enabled", "weekday"]);
	const errors: Record<string, string> = {};
	if (values.enabled !== "yes" && values.enabled !== "no") {
		errors.enabled = "Select whether to send return reminders";
	}
	const weekday = readWeekday(values.weekday);
	if (!weekday) errors.weekday = "Select the day return reminders are sent";
	if (Object.keys(errors).length || !weekday) return { values, errors };
	await saveServiceSettings(
		{ returnRemindersEnabled: values.enabled === "yes", returnReminderWeekday: weekday },
		user.id,
	);
	done("setting", "invites");
}

// Checklists ---------------------------------------------------------------

function checkLabel(label: string): string | undefined {
	if (!label) return "Enter the check";
	if (label.length > 200) return "Check must be 200 characters or fewer";
	return undefined;
}

export async function addCheckAction(
	list: ChecklistName,
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	await requireSettings();
	const values = fields(formData, ["label"]);
	const error = checkLabel(values.label);
	if (error) return { values, errors: { label: error } };
	await addChecklistItem(list, values.label);
	done("check-added", list === "decommission" ? "decom" : "prep");
}

export async function editCheckAction(
	list: ChecklistName,
	id: string,
	_state: SettingsFormState,
	formData: FormData,
): Promise<SettingsFormState> {
	await requireSettings();
	const values = fields(formData, ["label"]);
	const error = checkLabel(values.label);
	if (error) return { values, errors: { label: error } };
	await updateChecklistItem(list, id, values.label);
	done("check-saved", list === "decommission" ? "decom" : "prep");
}

// Remove and move ----------------------------------------------------------

const ANCHORS = {
	software: "software",
	faq: "faqs",
	device_preparation: "prep",
	decommission: "decom",
} as const;

/** "Remove" on its confirmation page. */
export async function removeItemAction(kind: string, id: string) {
	await requireSettings();
	if (!isSettingsKind(kind) || !/^\d+$/.test(id)) redirect(SETTINGS);
	await removeItem(kind, id);
	done(
		kind === "software" ? "software-removed" : kind === "faq" ? "faq-removed" : "check-removed",
		ANCHORS[kind],
	);
}

/** "Move up" and "Move down" on FAQs and checklist items. */
export async function moveItemAction(kind: string, id: string, direction: "up" | "down") {
	await requireSettings();
	if (!(kind === "faq" || isChecklistName(kind)) || !/^\d+$/.test(id)) redirect(SETTINGS);
	await moveItem(kind, id, direction);
	redirect(`${SETTINGS}#${ANCHORS[kind]}`);
}
