import { describe, expect, it } from "vitest";
import { prefixSums, windowOf } from "../../columns/virtual-window.js";

// A row with an explanation under its code line is TALLER than rowHeight. The
// virtual list must use the MEASURED height in its prefix sums, so spacers and
// the window (and every ribbon anchored through them) never drift. These lock
// the arithmetic the WIP rewrite introduced, on the current architecture.

describe("prefix sums with measured heights", () => {
	it("falls back to rowHeight for unmeasured slots", () => {
		expect(prefixSums(3, new Map(), 18)).toEqual([0, 18, 36, 54]);
	});

	it("uses the measured height of an explained row, not rowHeight", () => {
		// Slot 1 carries an explanation: 18px code + 16px note = 34px.
		const heights = new Map([[1, 34]]);
		expect(prefixSums(3, heights, 18)).toEqual([0, 18, 52, 70]);
	});

	it("keeps later offsets shifted by the extra height", () => {
		const heights = new Map([[0, 40], [2, 30]]);
		expect(prefixSums(4, heights, 18)).toEqual([0, 40, 58, 88, 106]);
	});
});

describe("window placement over uneven heights", () => {
	it("finds the slot by real offsets, not index × rowHeight", () => {
		// Slot 0 is 40px tall (explanation); at scrollTop 30 the viewport is
		// still INSIDE slot 0 — index math (30/18 → slot 1) would be wrong.
		const sums = prefixSums(5, new Map([[0, 40]]), 18);
		const range = windowOf({ sums, count: 5, top: 30, height: 18, headroom: 0 });
		expect(range.start).toBe(0);
	});

	it("starts after a tall explained row once it is fully above the viewport", () => {
		const sums = prefixSums(5, new Map([[0, 40]]), 18);
		const range = windowOf({ sums, count: 5, top: 40, height: 18, headroom: 0 });
		expect(range.start).toBe(1);
	});
});