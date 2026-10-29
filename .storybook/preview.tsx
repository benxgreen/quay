import "@/components/ui/bcp-design-system.css";

import type { Preview } from "@storybook/nextjs-vite";
import { Roboto } from "next/font/google";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"] });

const preview: Preview = {
	parameters: {
		layout: "padded",
		options: {
			storySort: { order: ["Introduction", "Components", "Patterns", "Service", "Layouts"] },
		},
		nextjs: {
			appDirectory: true,
		},
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		a11y: {
			// Fail the a11y panel (and any test run) on violations rather than just listing them.
			test: "error",
		},
	},
	decorators: [
		(Story) => (
			<div className={roboto.className}>
				<Story />
			</div>
		),
	],
};

export default preview;
