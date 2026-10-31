import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname),
			"server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		css: false,
		setupFiles: ["./vitest.setup.ts"],
		// Tests always use the mock clients, whatever .env says: .env files never
		// override variables that are already set.
		env: { HALO_CLIENT: "mock", EMAIL_CLIENT: "mock" },
		include: ["**/*.test.{ts,tsx}"],
		exclude: ["node_modules/**", ".next/**", "storybook-static/**"],
	},
});
