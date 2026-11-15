import { describe, expect, it } from "vitest";
import { resolveConfig, DEFAULT_CONFIG } from "../../config.js";

// The board is configurable, not closed: every display knob has a default and is
// overridable through the single config. These lock that contract.

describe("resolveConfig", () => {
	it("returns the defaults when nothing is given", () => {
		expect(resolveConfig()).toEqual(DEFAULT_CONFIG);
		expect(resolveConfig().rowHeight).toBe(18);
		expect(resolveConfig().foldUnconnected).toBe(true);
	});

	it("overrides only the fields provided", () => {
		const c = resolveConfig({ rowHeight: 24, diffContext: 5 });
		expect(c.rowHeight).toBe(24);
		expect(c.diffContext).toBe(5);
		expect(c.maxWordTokens).toBe(DEFAULT_CONFIG.maxWordTokens);
	});

	it("can turn off folding board-wide (git/merge shows every row)", () => {
		expect(resolveConfig({ foldUnconnected: false }).foldUnconnected).toBe(false);
	});

	it("carries a custom fold label", () => {
		const c = resolveConfig({ foldLabel: (n) => `${n} nodes hidden` });
		expect(c.foldLabel(3)).toBe("3 nodes hidden");
	});
});
