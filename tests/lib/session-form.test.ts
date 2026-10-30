import {
	type SessionFormValues,
	validateSessionForm,
} from "@/services/replacements/laptops/lib/session-form";

const VALID: SessionFormValues = {
	type: "collection",
	day: "12",
	month: "11",
	year: "2026",
	hour: "9",
	minute: "30",
	capacity: "10",
	location: "Room 310",
};
const today = "2026-10-29";

describe("validateSessionForm", () => {
	it("accepts a valid session and tidies the date and time", () => {
		expect(validateSessionForm(VALID, { today })).toEqual({
			ok: true,
			input: {
				type: "collection",
				date: "2026-11-12",
				time: "09:30",
				capacity: 10,
				location: "Room 310",
			},
		});
	});

	it("asks for everything when the form is empty", () => {
		const result = validateSessionForm(
			{
				type: "",
				day: "",
				month: "",
				year: "",
				hour: "",
				minute: "",
				capacity: "",
				location: " ",
			},
			{ today },
		);
		expect(result.ok || result.errors).toEqual({
			type: "Select the type of session",
			date: "Enter the date of the session",
			time: "Enter the start time",
			capacity: "Enter the capacity",
			location: "Enter the location",
		});
	});

	it.each([
		[{ day: "31", month: "11" }, "Date must be a real date"],
		[{ day: "", month: "11" }, "Date must include a day"],
		[{ day: "28", month: "10" }, "Date must be today or in the future"],
		[{ hour: "24" }, "Hour must be between 0 and 23"],
		[{ minute: "60" }, "Minute must be between 0 and 59"],
		[{ capacity: "2.5" }, "Capacity must be a whole number, like 10"],
		[{ capacity: "0" }, "Capacity must be 1 or more"],
	])("rejects %o", (change, message) => {
		const result = validateSessionForm({ ...VALID, ...change }, { today });
		expect(result.ok).toBe(false);
		expect(Object.values(result.ok ? {} : result.errors)).toContain(message);
	});

	it("allows today", () => {
		expect(validateSessionForm({ ...VALID, day: "29", month: "10" }, { today }).ok).toBe(true);
	});

	it("keeps capacity at or above current bookings, and the type while anyone is booked", () => {
		const result = validateSessionForm(
			{ ...VALID, type: "session", capacity: "2" },
			{ today, existing: { type: "collection", booked: 3 } },
		);
		expect(result.ok || result.errors).toMatchObject({
			type: "You cannot change the type while people are booked on this session",
			capacity: "Capacity cannot be less than the 3 people already booked",
		});
	});
});
