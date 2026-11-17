import { describe, expect, it } from "vitest";
import { measureRibbon, type RibbonColumnBox } from "../../ribbon/ribbon-measure.js";
import type { Ribbon } from "../../ribbon/ribbon-types.js";
import type { Box } from "../../rows/row-types.js";
import type { AnchorLookup } from "../../surface/surface-types.js";

// Geometry is domain-free and column-count-free. A ribbon names row ids; this
// measures their real boxes and returns bands + connectors. Crucially a ribbon
// can NEVER point into empty space: it only attaches to real (non-zero) rows.

const ROW = 18;
const box = (top: number, left = 0, right = 100): Box => ({ top, bottom: top + ROW - 2, left, right });

const lookupOf = (positions: Record<string, Record<string, number>>): AnchorLookup => (column, id) => {
	const row = positions[column]?.[id];
	return row === undefined ? null : box(row * ROW);
};

const columns: RibbonColumnBox[] = [
	{ id: "0", box: { top: 0, bottom: 1000, left: 0, right: 100 } },
	{ id: "1", box: { top: 0, bottom: 1000, left: 200, right: 300 } },
];

const ribbon = (ends: Ribbon["ends"], extra: Partial<Ribbon> = {}): Ribbon => ({ id: "c", ends, ...extra });

describe("measureRibbon", () => {
	it("draws one connector between two columns", () => {
		const lookup = lookupOf({ "0": { "1": 0 }, "1": { "1": 0 } });
		const shape = measureRibbon({ ribbon: ribbon([{ column: "0", rows: ["1"] }, { column: "1", rows: ["1"] }]), columns: columns, lookup, rowHeight: ROW });
		expect(shape?.connectors.length).toBe(1);
		expect(shape?.connectors[0]?.path).toContain("M");
		expect(shape?.connectors[0]?.path).toContain("Z");
	});

	it("draws connectors across three columns", () => {
		const three: RibbonColumnBox[] = [...columns, { id: "2", box: { top: 0, bottom: 1000, left: 400, right: 500 } }];
		const lookup = lookupOf({ "0": { "1": 0 }, "1": { "1": 0 }, "2": { "1": 0 } });
		const shape = measureRibbon({ ribbon: ribbon([{ column: "0", rows: ["1"] }, { column: "1", rows: ["1"] }, { column: "2", rows: ["1"] }]), columns: three, lookup, rowHeight: ROW });
		expect(shape?.connectors.length).toBe(2);
	});

	it("draws a stub when only one end exists (a one-sided member is visible)", () => {
		const lookup = lookupOf({ "0": { "1": 0 }, "1": {} });
		const shape = measureRibbon({ ribbon: ribbon([{ column: "0", rows: ["1"] }, { column: "1", rows: ["9"] }]), columns: columns, lookup, rowHeight: ROW });
		expect(shape).not.toBeNull();
		expect(shape?.connectors.length).toBe(1);
	});

	it("returns null when NO end has a measured row", () => {
		const lookup = lookupOf({ "0": {}, "1": {} });
		expect(measureRibbon({ ribbon: ribbon([{ column: "0", rows: ["9"] }, { column: "1", rows: ["9"] }]), columns: columns, lookup, rowHeight: ROW })).toBeNull();
	});

	it("ignores zero-height fold anchors — a ribbon never balloons into a fold", () => {
		// The left end names a real row AND a zero-height fold point far below.
		const lookup: AnchorLookup = (column, id) => {
			if (column === "0" && id === "1") return box(0);
			if (column === "0" && id === "fold") return { top: 500, bottom: 500, left: 0, right: 100 };
			if (column === "1" && id === "1") return box(0);
			return null;
		};
		const shape = measureRibbon({ ribbon: ribbon([{ column: "0", rows: ["1", "fold"] }, { column: "1", rows: ["1"] }]), columns: columns, lookup, rowHeight: ROW });
		// The ribbon's row coverage stays at the real row (top ~0), not 500.
		expect(shape).not.toBeNull();
		const ys = (shape?.connectors[0]?.path ?? "").split(/[MCZL]\s*/).flatMap((piece) => {
			const parts = piece.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
			return parts.length >= 2 ? [parts[1] ?? 0] : [];
		});
		expect(Math.min(...ys)).toBeLessThan(ROW + 2);
	});

	it("merges adjacent rows into ONE ribbon path spanning them", () => {
		const lookup = lookupOf({ "0": { "1": 0, "2": 1, "3": 2 }, "1": { "1": 0, "2": 1, "3": 2 } });
		const shape = measureRibbon({ ribbon: ribbon([{ column: "0", rows: ["1", "2", "3"] }, { column: "1", rows: ["1", "2", "3"] }]), columns: columns, lookup, rowHeight: ROW });
		expect(shape?.connectors.length).toBe(1);
		const ys = (shape?.connectors[0]?.path ?? "").split(/[MCZL]\s*/).flatMap((piece) => {
			const parts = piece.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
			return parts.length >= 2 ? [parts[parts.length - 1] ?? 0] : [];
		});
		expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(3 * ROW - 4);
	});
});
