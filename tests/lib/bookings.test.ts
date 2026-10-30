import { parseBookingsFilters } from "@/services/replacements/laptops/lib/bookings";

const TODAY = "2026-10-30";

describe("parseBookingsFilters", () => {
	it("shows search results in the all bookings view", () => {
		expect(parseBookingsFilters({ view: "day", date: TODAY, q: "Smith" }, TODAY)).toMatchObject(
			{
				view: "all",
				q: "Smith",
			},
		);
	});

	it("keeps the selected view when there is no search", () => {
		expect(parseBookingsFilters({ view: "week", date: TODAY }, TODAY).view).toBe("week");
	});
});
