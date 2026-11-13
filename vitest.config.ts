import { defineConfig } from "vitest/config";

// Two kinds of test, one runner:
//   tests/model/**  — pure logic (diff, connections, marks, geometry). No DOM.
//   tests/view/**   — the React board + controller, in jsdom.
export default defineConfig({
	test: {
		include: ["tests/**/*.test.{ts,tsx}"],
		environment: "node",
		setupFiles: ["tests/view/setup.ts"],
		testTimeout: 30000,
		hookTimeout: 30000,
	},
});