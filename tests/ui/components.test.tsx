import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Accordion } from "@/components/ui/accordion";
import { StepList } from "@/components/ui/step-list";
import { axeViolations } from "@/tests/axe";

describe("Accordion", () => {
	const sections = [
		{
			id: "a",
			heading: "Before your session",
			content: <p>Back up your files.</p>,
			open: true,
		},
		{ id: "b", heading: "On the day", content: <p>Go to Room 310.</p> },
	];

	it("opens a section and opens or closes them all", async () => {
		const user = userEvent.setup();
		render(<Accordion sections={sections} />);

		const day = screen.getByRole("button", { name: /On the day/ });
		expect(day).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Go to Room 310.")).not.toBeVisible();

		await user.click(day);
		expect(day).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Go to Room 310.")).toBeVisible();

		await user.click(screen.getByRole("button", { name: "Hide all sections" }));
		expect(screen.getByRole("button", { name: /Before your session/ })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		expect(screen.getByRole("button", { name: "Show all sections" })).toBeInTheDocument();
	});
});

describe("StepList", () => {
	it("numbers each step for screen readers and says its status", async () => {
		const { container } = render(
			<StepList
				steps={[
					{ id: "a", title: "Replacement device", status: "done" },
					{ id: "b", title: "Device preparation", status: "current" },
				]}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "Step 1: Replacement device Done" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Step 2: Device preparation Current step" }),
		).toBeInTheDocument();
		expect(await axeViolations(container)).toEqual([]);
	});
});

describe("Hidden text on links", () => {
	it("keeps a space between visible and hidden words", async () => {
		const { SummaryList } = await import("@/components/ui/summary-list");
		render(
			<SummaryList
				rows={[
					{
						key: "Booking",
						value: "Thursday",
						actions: [{ href: "#b", visuallyHiddenText: "booking" }],
					},
				]}
			/>,
		);

		expect(screen.getByRole("link", { name: "Change booking" })).toBeInTheDocument();
	});
});

describe("Markdown", () => {
	it("renders the team's content as accessible elements", async () => {
		const { Markdown } = await import("@/components/ui/markdown");
		const { container } = render(
			<Markdown>
				{
					"## On the day\n\nBring your **charger**.\n\n- [Choose a new date](/my/replacements/laptop)\n- Keep using your laptop\n\n%Do not wipe your laptop yourself.%"
				}
			</Markdown>,
		);

		expect(screen.getByRole("heading", { level: 2, name: "On the day" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Choose a new date" })).toHaveAttribute(
			"href",
			"/my/replacements/laptop",
		);
		expect(screen.getByText("Warning:", { exact: false })).toBeInTheDocument();
		expect(await axeViolations(container)).toEqual([]);
	});
});

describe("Meter and status tags", () => {
	it("hides the bar from screen readers and shows status as words", async () => {
		const { Meter } = await import("@/components/ui/meter");
		const { SessionStatusTag, CaseStatusTag } = await import(
			"@/components/service/replacements/status-tag"
		);
		const { container } = render(
			<p>
				7 of 10
				<Meter value={7} max={10} />
				<SessionStatusTag status="full" />
				<CaseStatusTag status="rebook_required" />
			</p>,
		);

		expect(container.querySelector(".bcp-meter")).toHaveAttribute("aria-hidden", "true");
		expect(container.querySelector(".bcp-meter-fill")).toHaveStyle({ width: "70%" });
		expect(screen.getByText("Full")).toBeInTheDocument();
		expect(screen.getByText("Rebook required")).toBeInTheDocument();
		expect(await axeViolations(container)).toEqual([]);
	});
});
