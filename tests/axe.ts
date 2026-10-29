import axe from "axe-core";

/**
 * Runs axe over the rendered container and returns readable violations.
 * Colour contrast is left out because jsdom cannot compute styles; it is
 * covered by Storybook's Accessibility panel in a real browser.
 */
export async function axeViolations(container: Element): Promise<string[]> {
	const results = await axe.run(container, {
		rules: { "color-contrast": { enabled: false } },
	});
	return results.violations.map(
		(violation) =>
			`${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`,
	);
}
