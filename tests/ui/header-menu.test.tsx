import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderMenu } from "@/components/ui/header-menu";
import { menuGroups } from "@/lib/portal/navigation";
import { axeViolations } from "@/tests/axe";

const navigation = vi.hoisted(() => ({ pathname: "/manage" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

describe("HeaderMenu", () => {
	beforeEach(() => {
		navigation.pathname = "/manage";
	});

	it("closes when the route changes", async () => {
		const user = userEvent.setup();
		const groups = menuGroups(["administrator", "laptops_team"]);
		const { rerender } = render(<HeaderMenu homeHref="/manage" groups={groups} />);

		await user.click(screen.getByRole("button", { name: "Menu" }));
		expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);

		navigation.pathname = "/manage/users";
		rerender(<HeaderMenu homeHref="/manage" groups={groups} />);

		expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		expect(screen.queryByRole("navigation", { name: "Menu" })).not.toBeInTheDocument();
	});

	it("opens and closes the menu as a disclosure", async () => {
		const user = userEvent.setup();
		render(
			<HeaderMenu
				homeHref="/manage"
				homeLabel="BCP Council Device portal"
				groups={menuGroups(["administrator", "laptops_team"])}
			/>,
		);

		const button = screen.getByRole("button", { name: "Menu" });
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("navigation", { name: "Menu" })).not.toBeInTheDocument();

		await user.click(button);
		expect(button).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByRole("link", { name: "Laptop replacements" })).toBeVisible();

		await user.click(button);
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("navigation", { name: "Menu" })).not.toBeInTheDocument();
	});

	it("returns focus to the button when Escape closes the menu", async () => {
		const user = userEvent.setup();
		render(
			<HeaderMenu
				homeHref="/manage"
				homeLabel="BCP Council Device portal"
				groups={menuGroups(["administrator", "laptops_team"])}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Menu" }));
		screen.getByRole("link", { name: "Portal settings" }).focus();
		await user.keyboard("{Escape}");

		expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
		expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
	});

	it("shows Management to administrators only", async () => {
		const user = userEvent.setup();
		const { unmount } = render(
			<HeaderMenu
				homeHref="/manage"
				homeLabel="BCP Council Device portal"
				groups={menuGroups(["laptops_team"])}
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Menu" }));
		expect(screen.queryByRole("heading", { name: "Management" })).not.toBeInTheDocument();
		unmount();

		render(
			<HeaderMenu
				homeHref="/manage"
				homeLabel="BCP Council Device portal"
				groups={menuGroups(["administrator", "laptops_team"])}
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Menu" }));
		expect(screen.getByRole("heading", { name: "Management" })).toBeInTheDocument();
	});

	it("shows only the council logo, named for the home link, and has no axe violations", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<HeaderMenu
				homeHref="/manage"
				homeLabel="BCP Council Device portal"
				groups={menuGroups(["administrator", "laptops_team"])}
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Menu" }));

		const home = screen.getByRole("link", { name: "BCP Council Device portal" });
		expect(home).toHaveAttribute("href", "/manage");
		expect(home).toHaveTextContent("");
		expect(await axeViolations(container)).toEqual([]);
	});
});
