import type { ReplacementType } from "@/components/service/replacements/type-tag";
import type { IsoDate } from "@/lib/dates/working-days";

/** What the Add and Edit session forms send, as typed. */
export type SessionFormValues = {
	type: string;
	day: string;
	month: string;
	year: string;
	hour: string;
	minute: string;
	capacity: string;
	location: string;
};

export type SessionInput = {
	type: ReplacementType;
	date: IsoDate;
	/** HH:MM, 24-hour. */
	time: string;
	capacity: number;
	location: string;
};

export type SessionFormErrors = Partial<
	Record<"type" | "date" | "time" | "capacity" | "location", string>
> & { dateParts?: ("day" | "month" | "year")[]; timeParts?: ("hour" | "minute")[] };

type Context = {
	/** London today, or the dev "as if today is" date. */
	today: IsoDate;
	/** When editing: the session's current type and active bookings. */
	existing?: { type: ReplacementType; booked: number };
};

const WHOLE = /^\d+$/;

/**
 * Checks the Add or Edit session form (spec, "Sessions"): type required;
 * a real date, not in the past; hour 0–23 and minute 0–59; capacity a
 * whole number, 1 or more and not below current bookings; location
 * required. The type can't change while people are booked, because a
 * booking must match its case's type.
 */
export function validateSessionForm(
	values: SessionFormValues,
	{ today, existing }: Context,
): { ok: true; input: SessionInput } | { ok: false; errors: SessionFormErrors } {
	const errors: SessionFormErrors = {};

	const type = values.type === "collection" || values.type === "session" ? values.type : null;
	if (!type) {
		errors.type = "Select the type of session";
	} else if (existing && existing.booked > 0 && type !== existing.type) {
		errors.type = "You cannot change the type while people are booked on this session";
	}

	const date = checkDate(values, today, errors);
	const time = checkTime(values, errors);

	const capacityText = values.capacity.trim();
	const capacity = Number(capacityText);
	if (!capacityText) {
		errors.capacity = "Enter the capacity";
	} else if (!WHOLE.test(capacityText)) {
		errors.capacity = "Capacity must be a whole number, like 10";
	} else if (capacity < 1) {
		errors.capacity = "Capacity must be 1 or more";
	} else if (existing && capacity < existing.booked) {
		errors.capacity = `Capacity cannot be less than the ${existing.booked} ${existing.booked === 1 ? "person" : "people"} already booked`;
	}

	const location = values.location.trim();
	if (!location) errors.location = "Enter the location";

	if (!type || !date || !time || Object.keys(errors).length > 0) {
		return { ok: false, errors };
	}
	return { ok: true, input: { type, date, time, capacity, location } };
}

function checkDate(values: SessionFormValues, today: IsoDate, errors: SessionFormErrors) {
	const parts = { day: values.day.trim(), month: values.month.trim(), year: values.year.trim() };
	const missing = (Object.keys(parts) as (keyof typeof parts)[]).filter((part) => !parts[part]);
	if (missing.length === 3) {
		errors.date = "Enter the date of the session";
		return null;
	}
	if (missing.length > 0) {
		errors.date = `Date must include a ${missing.join(" and ")}`;
		errors.dateParts = missing;
		return null;
	}
	const day = Number(parts.day);
	const month = Number(parts.month);
	const year = Number(parts.year);
	const real =
		WHOLE.test(parts.day) &&
		WHOLE.test(parts.month) &&
		/^\d{4}$/.test(parts.year) &&
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
	if (!real) {
		errors.date = "Date must be a real date";
		return null;
	}
	const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	if (iso < today) {
		errors.date = "Date must be today or in the future";
		return null;
	}
	return iso;
}

function checkTime(values: SessionFormValues, errors: SessionFormErrors) {
	const hourText = values.hour.trim();
	const minuteText = values.minute.trim();
	if (!hourText && !minuteText) {
		errors.time = "Enter the start time";
		return null;
	}
	const hour = Number(hourText);
	const minute = Number(minuteText);
	if (!hourText || !WHOLE.test(hourText) || hour > 23) {
		errors.time = "Hour must be between 0 and 23";
		errors.timeParts = ["hour"];
		return null;
	}
	if (!minuteText || !WHOLE.test(minuteText) || minute > 59) {
		errors.time = "Minute must be between 0 and 59";
		errors.timeParts = ["minute"];
		return null;
	}
	return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
