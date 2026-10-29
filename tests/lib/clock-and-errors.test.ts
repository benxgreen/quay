import { londonToday, resolveToday } from "@/lib/clock";
import { describeConstraintError } from "@/lib/db/errors";

describe("clock", () => {
	it("uses the London date, not UTC", () => {
		// 23:30 UTC on 30 June is 00:30 on 1 July in London (BST).
		expect(londonToday(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
		// In winter London is on UTC.
		expect(londonToday(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12-31");
	});

	it("lets development run as if today is another date", () => {
		expect(resolveToday("2026-11-12")).toBe("2026-11-12");
		expect(resolveToday(undefined, new Date("2026-10-29T09:00:00Z"))).toBe("2026-10-29");
		expect(() => resolveToday("not a date")).toThrow();
	});

	it("refuses the override in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => resolveToday("2026-11-12")).toThrow(/only allowed in development/);
		vi.unstubAllEnvs();
	});
});

describe("describeConstraintError", () => {
	it("explains a full session", () => {
		expect(describeConstraintError({ constraint: "sessions_not_overbooked" })).toEqual({
			constraint: "sessions_not_overbooked",
			problem: "session_unavailable",
			message: "That date has just filled up. Choose another.",
		});
	});

	it("leaves unknown errors alone", () => {
		expect(describeConstraintError({ constraint: "something_else" })).toBeUndefined();
		expect(describeConstraintError(new Error("boom"))).toBeUndefined();
		expect(describeConstraintError(null)).toBeUndefined();
	});
});
