import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorSummary } from "@/components/ui/error-summary";
import { NotificationBanner } from "@/components/ui/notification-banner";
import { axeViolations } from "@/tests/axe";

describe("ErrorSummary", () => {
	it("takes focus when it appears and links each error to its field", async () => {
		Element.prototype.scrollIntoView = vi.fn();
		render(
			<>
				<ErrorSummary
					errors={[{ fieldId: "capacity", text: "Capacity must be 1 or more" }]}
				/>
				<label htmlFor="capacity">Capacity</label>
				<input id="capacity" />
			</>,
		);

		const summary = screen.getByRole("alert").parentElement;
		expect(summary).toHaveFocus();

		await userEvent.click(screen.getByRole("link", { name: "Capacity must be 1 or more" }));
		expect(screen.getByLabelText("Capacity")).toHaveFocus();
	});

	it("renders nothing without errors", () => {
		const { container } = render(<ErrorSummary errors={[]} />);

		expect(container).toBeEmptyDOMElement();
	});
});

describe("NotificationBanner", () => {
	it("announces success and failure as alerts", () => {
		render(<NotificationBanner variant="failed" heading="Replacement not completed" />);

		expect(screen.getByRole("alert", { name: "Failed" })).toHaveTextContent(
			"Replacement not completed",
		);
	});

	it("shows Important as a labelled region, not an alert", async () => {
		const { container } = render(
			<NotificationBanner variant="important" heading="Your session has been cancelled" />,
		);

		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByRole("region", { name: "Important" })).toBeInTheDocument();
		expect(await axeViolations(container)).toEqual([]);
	});
});
