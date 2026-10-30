import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddAnother } from "@/components/patterns/add-another";
import { FilterOptions, FilterPanel } from "@/components/patterns/filter-panel";
import { Journal } from "@/components/patterns/journal";
import { axeViolations } from "@/tests/axe";

describe("FilterPanel", () => {
	it("shows and hides the filters with a disclosure button", async () => {
		const user = userEvent.setup();
		render(
			<FilterPanel search={{ label: "Search cases" }} clearHref="/cases">
				<FilterOptions>
					<label>
						<input type="checkbox" name="flagged" /> Flagged only
					</label>
				</FilterOptions>
			</FilterPanel>,
		);

		const toggle = screen.getByRole("button", { name: "Show filters" });
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("checkbox", { name: "Flagged only" })).not.toBeInTheDocument();

		await user.click(toggle);
		expect(screen.getByRole("button", { name: "Hide filters" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
		expect(screen.getByRole("checkbox", { name: "Flagged only" })).toBeVisible();
		expect(screen.getByRole("searchbox", { name: "Search cases" })).toHaveAttribute(
			"name",
			"q",
		);
	});
});

describe("AddAnother", () => {
	it("adds a box and moves focus to it, and names Remove for screen readers", async () => {
		const user = userEvent.setup();
		render(<AddAnother name="other" itemLabel="Software" defaultValues={["Visio"]} />);

		await user.click(screen.getByRole("button", { name: "Add another" }));
		expect(screen.getByLabelText("Software 2")).toHaveFocus();

		await user.click(screen.getByRole("button", { name: "Remove software 1" }));
		expect(screen.queryByDisplayValue("Visio")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Software 1")).toHaveFocus();
	});
});

describe("Journal", () => {
	const items = [
		{
			id: "1",
			when: "26 Oct 2026, 9:00am",
			text: "Email sent: invitation to user",
			who: "System",
		},
	];

	it("has the heading, the note form and the entries", async () => {
		const { container } = render(<Journal items={items} noteAction="/notes" />);

		expect(screen.getByRole("region", { name: "Journal" })).toBeInTheDocument();
		expect(screen.getByLabelText("Add a note")).toHaveAttribute("name", "note");
		expect(screen.getByRole("button", { name: "Add note" })).toHaveAttribute("type", "submit");
		expect(screen.getByText("Email sent: invitation to user")).toBeInTheDocument();
		expect(await axeViolations(container)).toEqual([]);
	});

	it("has no note form when read-only", () => {
		render(<Journal items={items} />);

		expect(screen.queryByLabelText("Add a note")).not.toBeInTheDocument();
	});
});

describe("FilterBar", () => {
	it("is a named search that submits a GET", async () => {
		const { FilterBar } = await import("@/components/patterns/filter-bar");
		const { TextInput } = await import("@/components/ui/text-input");
		const { container } = render(
			<FilterBar label="Users">
				<TextInput id="q" name="q" label="Search by name, email or username" />
			</FilterBar>,
		);

		const form = screen.getByRole("search", { name: "Users" });
		expect(form).toHaveAttribute("method", "get");
		expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
		expect(await axeViolations(container)).toEqual([]);
	});
});

describe("Checklist", () => {
	it("counts ticks and says when there are unsaved changes", async () => {
		const { Checklist } = await import("@/components/patterns/checklist");
		const user = userEvent.setup();
		const { container } = render(
			<Checklist
				legend="Device preparation checks"
				name="check"
				action={async () => {}}
				saveText="Save preparation checks"
				confirmText="Confirm device prepared"
				saved="Last saved by John Smith"
				items={[
					{ value: "1", label: "Primary user changed in Intune", ticked: true },
					{ value: "2", label: "Windows updates installed", ticked: false },
				]}
			/>,
		);

		expect(screen.getByText("1 of 2 done")).toBeInTheDocument();
		expect(screen.getByText("Last saved by John Smith")).toBeInTheDocument();
		await user.click(screen.getByLabelText("Windows updates installed"));
		expect(screen.getByText("2 of 2 done")).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("You have unsaved changes");
		expect(screen.getByRole("button", { name: "Confirm device prepared" })).toHaveAttribute(
			"value",
			"confirm",
		);
		expect(await axeViolations(container)).toEqual([]);
	});
});
