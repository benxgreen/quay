import {
	estimatedInvitation,
	invitationRunDays,
} from "@/services/replacements/laptops/lib/invitation-dates";

describe("invitation dates", () => {
	it("starts today before 9am on a working day, otherwise the next working day", () => {
		expect(invitationRunDays({ day: "2026-11-02", time: "08:59" }, [], 2)).toEqual([
			"2026-11-02",
			"2026-11-03",
		]);
		expect(invitationRunDays({ day: "2026-11-02", time: "09:00" }, [], 1)).toEqual([
			"2026-11-03",
		]);
		// Friday afternoon → Monday
		expect(invitationRunDays({ day: "2026-11-06", time: "14:00" }, [], 1)).toEqual([
			"2026-11-09",
		]);
	});

	it("skips bank holidays", () => {
		expect(
			invitationRunDays(
				{ day: "2026-12-24", time: "10:00" },
				["2026-12-25", "2026-12-28"],
				2,
			),
		).toEqual(["2026-12-29", "2026-12-30"]);
	});

	it("estimates each place in the queue at the daily limit", () => {
		const days = ["2026-11-02", "2026-11-03", "2026-11-04"];
		expect([1, 15, 16, 30, 31, 46].map((p) => estimatedInvitation(p, 15, days))).toEqual([
			"2026-11-02",
			"2026-11-02",
			"2026-11-03",
			"2026-11-03",
			"2026-11-04",
			null,
		]);
	});
});
