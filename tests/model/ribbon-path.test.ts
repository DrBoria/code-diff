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

	it("returns null when an end has no measured row (no road to nowhere)", () => {
		const lookup = lookupOf({ "0": { "1": 0 }, "1": {} });
		expect(measureRibbon({ ribbon: ribbon([{ column: "0", rows: ["1"] }, { column: "1", rows: ["9"] }]), columns: columns, lookup, rowHeight: ROW })).toBeNull();
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
		// The band must stay at the real row (top ~0), not stretch to 500.
		expect(shape).not.toBeNull();
		const maxBottom = Math.max(...(shape?.bands ?? []).map((b) => b.bottom));
		expect(maxBottom).toBeLessThan(ROW + 2);
	});

	it("merges adjacent rows into one band", () => {
		const lookup = lookupOf({ "0": { "1": 0, "2": 1, "3": 2 }, "1": { "1": 0, "2": 1, "3": 2 } });
		const shape = measureRibbon({ ribbon: ribbon([{ column: "0", rows: ["1", "2", "3"] }, { column: "1", rows: ["1", "2", "3"] }]), columns: columns, lookup, rowHeight: ROW });
		expect(shape?.bands.filter((b) => b.column === "0").length).toBe(1);
	});
});
