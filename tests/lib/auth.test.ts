import { safeReturnTo } from "@/lib/auth/constants";
import { isReference, newReference } from "@/lib/auth/reference";
import { formatAgo, formatUpdatedAt, formatWhen } from "@/lib/dates/format";
import { ACCESS, canAccess } from "@/lib/portal/access";
import { menuGroups } from "@/lib/portal/navigation";
import { describeChange, groupRoleChanges, parseUserFilters } from "@/lib/portal/users";

describe("safeReturnTo", () => {
	it("only allows paths within the portal", () => {
		expect(safeReturnTo("/manage/users?q=priya")).toBe("/manage/users?q=priya");
		expect(safeReturnTo("//evil.example/")).toBeNull();
		expect(safeReturnTo("/\\evil.example")).toBeNull();
		expect(safeReturnTo("https://evil.example")).toBeNull();
		expect(safeReturnTo(undefined)).toBeNull();
	});
});

describe("sign-in references", () => {
	it("are short, unambiguous and recognisable", () => {
		const reference = newReference();
		expect(reference).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
		expect(reference).not.toMatch(/[015ILOS]/);
		expect(isReference(reference)).toBe(true);
		expect(isReference("<script>")).toBe(false);
	});
});

describe("access", () => {
	it("lets a service admin do what its team can, but not the other way round", () => {
		expect(canAccess(["laptops_admin"], ACCESS.laptops)).toBe(true);
		expect(canAccess(["laptops_team"], ACCESS.laptopsSettings)).toBe(false);
		expect(canAccess(["administrator"], ACCESS.laptops)).toBe(false);
	});

	it("lists only what someone can open in the Menu", () => {
		expect(menuGroups(["laptops_team"])).toEqual([
			{
				title: "Services",
				links: [{ text: "Laptop replacements", href: "/manage/replacements/laptops" }],
			},
		]);
		expect(menuGroups(["administrator"]).map((group) => group.title)).toEqual(["Management"]);
		expect(menuGroups([])).toEqual([]);
	});
});

describe("Users pages", () => {
	it("reads filters from the URL, ignoring anything unknown", () => {
		expect(parseUserFilters({ q: " priya ", role: "laptops_team", show: "portal" })).toEqual({
			search: "priya",
			role: "laptops_team",
			show: "portal",
		});
		expect(parseUserFilters({ role: "superuser", show: "all" })).toEqual({
			search: "",
			role: "",
			show: "directory",
		});
	});

	it("groups role changes saved together into one line", () => {
		const at = new Date("2026-10-29T12:58:00Z");
		const groups = groupRoleChanges([
			{ role: "laptops_team", change: "added", changed_at: at, by: "Ben Green" },
			{ role: "laptops_admin", change: "removed", changed_at: at, by: "Ben Green" },
			{
				role: "laptops_admin",
				change: "added",
				changed_at: new Date("2026-09-03T10:00:00Z"),
				by: "Ben Green",
			},
		]);
		expect(groups.map(describeChange)).toEqual([
			"Laptop replacements team added and Laptop replacements admin removed by Ben Green",
			"Laptop replacements admin added by Ben Green",
		]);
	});

	it("says when, in London time", () => {
		const now = new Date("2026-11-12T15:00:00Z");
		expect(formatWhen(new Date("2026-11-12T09:02:00Z"), now)).toBe("Today, 9:02am");
		expect(formatWhen(new Date("2026-11-11T15:15:00Z"), now)).toBe("Yesterday, 3:15pm");
		expect(formatWhen(new Date("2026-09-03T11:00:00Z"), now)).toBe("3 Sep 2026");
		// 23:30 UTC on 29 Oct is still 29 Oct in London (GMT), but 23:30 UTC on
		// 24 Oct is 00:30 on 25 Oct (BST).
		expect(formatWhen(new Date("2026-10-24T23:30:00Z"), now)).toBe("25 Oct 2026");
	});
});

describe("relative dates", () => {
	it("says how long ago and when the report was updated, in London time", () => {
		const now = new Date("2026-11-12T15:00:00Z");
		expect(
			[
				"2026-11-12T08:00:00Z",
				"2026-11-11T08:00:00Z",
				"2026-11-09T08:00:00Z",
				"2026-10-29T08:00:00Z",
				"2026-08-01T08:00:00Z",
			].map((iso) => formatAgo(new Date(iso), now)),
		).toEqual(["Today", "Yesterday", "3 days ago", "2 weeks ago", "1 Aug 2026"]);
		expect(formatUpdatedAt(new Date("2026-11-12T09:14:00Z"), now)).toBe("9:14am today");
		expect(formatUpdatedAt(new Date("2026-11-03T09:14:00Z"), now)).toBe("9:14am on 3 Nov 2026");
	});
});
