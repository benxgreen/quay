import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShowMore } from "@/components/ui/show-more";

describe("ShowMore", () => {
	it("reads out the count and asks for more", async () => {
		const onShowMore = vi.fn();
		render(<ShowMore shown={20} total={41} noun="cases" onShowMore={onShowMore} />);

		expect(screen.getByText("Showing 20 of 41 cases")).toHaveAttribute("aria-live", "polite");
		await userEvent.click(screen.getByRole("button", { name: "Show more" }));
		expect(onShowMore).toHaveBeenCalledTimes(1);
	});

	it("ignores clicks while a batch is loading", async () => {
		let finish: () => void = () => {};
		const onShowMore = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		render(<ShowMore shown={20} total={41} noun="cases" onShowMore={onShowMore} />);

		const button = screen.getByRole("button", { name: "Show more" });
		await userEvent.click(button);
		await userEvent.click(button);
		expect(button).toHaveAttribute("aria-disabled", "true");
		expect(onShowMore).toHaveBeenCalledTimes(1);
		finish();
	});

	it("hides the button once everything is shown", () => {
		render(<ShowMore shown={41} total={41} noun="cases" onShowMore={() => {}} />);

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
		expect(screen.getByText("Showing 41 of 41 cases")).toBeInTheDocument();
	});
});
