import {
	addWorkingDays,
	assertIsoDate,
	isBookableByColleague,
	isoWeekday,
	isSoftwareLocked,
	isWeeklySendDay,
	isWorkingDay,
	nextWorkingDay,
	softwareLockDate,
	subtractWorkingDays,
} from "@/lib/dates/working-days";

// England and Wales, from the GOV.UK feed.
const HOLIDAYS = ["2026-12-25", "2026-12-28", "2027-01-01", "2027-03-26", "2027-03-29"];

describe("working days", () => {
	it("knows the day of the week", () => {
		expect(isoWeekday("2026-11-12")).toBe(4); // Thursday
		expect(isoWeekday("2026-11-15")).toBe(7); // Sunday
	});

	it("excludes weekends and bank holidays", () => {
		expect(isWorkingDay("2026-11-12", HOLIDAYS)).toBe(true);
		expect(isWorkingDay("2026-11-14", HOLIDAYS)).toBe(false);
		expect(isWorkingDay("2026-12-28", HOLIDAYS)).toBe(false);
	});

	it("adds working days like lr.add_working_days", () => {
		expect(addWorkingDays("2026-11-12", 0, HOLIDAYS)).toBe("2026-11-12");
		expect(addWorkingDays("2026-11-12", 3, HOLIDAYS)).toBe("2026-11-17");
		expect(addWorkingDays("2026-12-24", 1, HOLIDAYS)).toBe("2026-12-29");
	});

	it("subtracts working days across a bank holiday weekend", () => {
		expect(subtractWorkingDays("2026-12-29", 1, HOLIDAYS)).toBe("2026-12-24");
	});

	it("finds the next working day", () => {
		expect(nextWorkingDay("2026-12-25", HOLIDAYS)).toBe("2026-12-29");
		expect(nextWorkingDay("2026-11-12", HOLIDAYS)).toBe("2026-11-12");
	});

	it("moves weekly emails to the next working day after a bank holiday", () => {
		expect(isWeeklySendDay("2026-12-21", 1, HOLIDAYS)).toBe(true);
		expect(isWeeklySendDay("2026-12-28", 1, HOLIDAYS)).toBe(false);
		expect(isWeeklySendDay("2026-12-29", 1, HOLIDAYS)).toBe(true);
		expect(isWeeklySendDay("2026-12-22", 1, HOLIDAYS)).toBe(false);
		expect(isWeeklySendDay("2027-03-30", 5, HOLIDAYS)).toBe(true);
	});

	it("locks software on the 3rd working day before the session (the spec's example)", () => {
		expect(softwareLockDate("2026-11-12", 3, HOLIDAYS)).toBe("2026-11-09");
		expect(isSoftwareLocked("2026-11-12", 3, "2026-11-08", HOLIDAYS)).toBe(false);
		expect(isSoftwareLocked("2026-11-12", 3, "2026-11-09", HOLIDAYS)).toBe(true);
	});

	it("only offers sessions more than the lead time away", () => {
		expect(isBookableByColleague("2026-11-09", 5, "2026-11-02", HOLIDAYS)).toBe(false);
		expect(isBookableByColleague("2026-11-10", 5, "2026-11-02", HOLIDAYS)).toBe(true);
	});

	it("rejects dates that are not real", () => {
		expect(() => assertIsoDate("2026-02-30")).toThrow();
		expect(() => assertIsoDate("12/11/2026")).toThrow();
		expect(assertIsoDate("2026-11-12")).toBe("2026-11-12");
	});
});
