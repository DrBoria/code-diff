import { describe, expect, it } from "vitest";
import { resolveOptions, DEFAULT_OPTIONS } from "../../config.js";

// The board is configurable, not closed: every display knob has a default and is
// overridable. These lock that contract.

describe("resolveOptions", () => {
	it("returns the defaults when nothing is given", () => {
		expect(resolveOptions()).toEqual(DEFAULT_OPTIONS);
		expect(resolveOptions().rowHeight).toBe(18);
		expect(resolveOptions().foldUnconnected).toBe(true);
	});

	it("overrides only the fields provided", () => {
		const o = resolveOptions({ rowHeight: 24, diffContext: 5 });
		expect(o.rowHeight).toBe(24);
		expect(o.diffContext).toBe(5);
		expect(o.maxWordTokens).toBe(DEFAULT_OPTIONS.maxWordTokens);
	});

	it("can turn off folding board-wide (git/merge shows every row)", () => {
		expect(resolveOptions({ foldUnconnected: false }).foldUnconnected).toBe(false);
	});

	it("carries a custom fold label", () => {
		const o = resolveOptions({ foldLabel: (n) => `${n} nodes hidden` });
		expect(o.foldLabel?.(3)).toBe("3 nodes hidden");
	});
});