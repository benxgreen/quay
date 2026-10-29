import { render, screen } from "@testing-library/react";
import { Checkboxes } from "@/components/ui/checkboxes";
import { DateInput } from "@/components/ui/date-input";
import { Radios } from "@/components/ui/radios";
import { TextInput } from "@/components/ui/text-input";
import { TimeInput } from "@/components/ui/time-input";
import { axeViolations } from "@/tests/axe";

describe("TextInput", () => {
	it("links the hint and error to the field", () => {
		render(
			<TextInput
				id="capacity"
				name="capacity"
				label="Capacity"
				hint="Places on the session"
				error="Capacity must be 1 or more"
			/>,
		);

		const input = screen.getByLabelText("Capacity");
		expect(input).toHaveAttribute("aria-describedby", "capacity-hint capacity-error");
		expect(input).toHaveAccessibleDescription(
			"Places on the session Error: Capacity must be 1 or more",
		);
		expect(input).toHaveClass("bcp-input--error");
	});

	it("leaves aria-describedby off when there is no hint or error", () => {
		render(<TextInput id="location" name="location" label="Location" />);

		expect(screen.getByLabelText("Location")).not.toHaveAttribute("aria-describedby");
	});

	it("can be the page heading", () => {
		render(
			<TextInput id="serial" name="serial" label="Old device serial number" isPageHeading />,
		);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"Old device serial number",
		);
	});
});

describe("Radios", () => {
	const items = [
		{ value: "collection", label: "Collection", hint: "Colleagues pick up a laptop" },
		{ divider: "or" },
		{ value: "session", label: "Session", conditional: <p>Extra question</p> },
	];

	it("gives the first radio the group id so the error summary can link to it", () => {
		render(<Radios name="type" legend="Type" items={items} error="Select a type" />);

		const [first, second] = screen.getAllByRole("radio");
		expect(first).toHaveAttribute("id", "type");
		expect(second).toHaveAttribute("id", "type-2");
		expect(screen.getByRole("group", { name: "Type" })).toHaveAccessibleDescription(
			"Error: Select a type",
		);
	});

	it("links item hints and conditional content", () => {
		render(<Radios name="type" legend="Type" items={items} value="session" />);

		expect(screen.getByLabelText("Collection")).toHaveAccessibleDescription(
			"Colleagues pick up a laptop",
		);
		const session = screen.getByLabelText("Session");
		expect(session).toBeChecked();
		expect(session).toHaveAttribute("aria-controls", "conditional-type-2");
		expect(document.getElementById("conditional-type-2")).toHaveTextContent("Extra question");
	});

	it("renders the divider between options", () => {
		render(<Radios name="type" legend="Type" items={items} />);

		expect(screen.getByText("or")).toHaveClass("bcp-radios-divider");
	});
});

describe("Checkboxes", () => {
	it("ticks the given values", () => {
		render(
			<Checkboxes
				name="software"
				legend="What software do you need?"
				values={["Visio"]}
				items={[
					{ value: "Acrobat", label: "Adobe Acrobat Pro" },
					{ value: "Visio", label: "Microsoft Visio" },
				]}
			/>,
		);

		expect(screen.getByLabelText("Adobe Acrobat Pro")).not.toBeChecked();
		expect(screen.getByLabelText("Microsoft Visio")).toBeChecked();
	});
});

describe("DateInput and TimeInput", () => {
	it("names each box from the field name and outlines only the parts in error", () => {
		render(
			<DateInput
				name="date"
				legend="Date"
				error="Date must include a year"
				errorParts={["year"]}
				value={{ day: "12", month: "11" }}
			/>,
		);

		expect(screen.getByLabelText("Day")).toHaveAttribute("name", "date-day");
		expect(screen.getByLabelText("Day")).toHaveValue("12");
		expect(screen.getByLabelText("Day")).not.toHaveClass("bcp-input--error");
		expect(screen.getByLabelText("Year")).toHaveClass("bcp-input--error");
		expect(screen.getByRole("group", { name: "Date" })).toHaveAccessibleDescription(
			"Error: Date must include a year",
		);
	});

	it("uses numeric keyboards and the 24-hour hint for time", () => {
		render(<TimeInput name="start" legend="Start time" />);

		expect(screen.getByLabelText("Hour")).toHaveAttribute("inputmode", "numeric");
		expect(screen.getByRole("group", { name: "Start time" })).toHaveAccessibleDescription(
			"Use the 24-hour clock, for example 14 30",
		);
	});
});

it("has no axe violations across the form inputs", async () => {
	const { container } = render(
		<form>
			<TextInput id="location" name="location" label="Location" hint="Building and room" />
			<DateInput name="date" legend="Date" error="Enter a date" />
			<TimeInput name="start" legend="Start time" />
			<Radios
				name="type"
				legend="Type"
				items={[
					{ value: "collection", label: "Collection" },
					{ value: "session", label: "Session" },
				]}
			/>
		</form>,
	);

	expect(await axeViolations(container)).toEqual([]);
});
