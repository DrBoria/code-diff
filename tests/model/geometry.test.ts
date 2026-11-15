import { describe, expect, it } from "vitest";
import { connectionShape, shapesOf, type AnchorLookup, type RibbonColumn } from "../../geometry/ribbon.js";
import type { Box, Connection } from "../../interface/types.js";

// Geometry is domain-free and column-count-free. A connection names ids; this
// measures them and returns bands + ribbons. These lock the band-merging rule
// (visual adjacency, ANY id type) and the N-column ribbon behaviour.

const ROW = 18;
const box = (top: number, left = 0, right = 100): Box => ({ top, bottom: top + ROW - 2, left, right });

// A lookup that places each id at a row index * ROW. Ids may be numeric strings
// or arbitrary paths — geometry must not care.
const lookupOf = (positions: Record<string, Record<string, number>>): AnchorLookup => (column, id) => {
	const row = positions[column]?.[id];
	return row === undefined ? null : box(row * ROW);
};

const columns: RibbonColumn[] = [
	{ id: "0", box: { top: 0, bottom: 1000, left: 0, right: 100 } },
	{ id: "1", box: { top: 0, bottom: 1000, left: 200, right: 300 } },
];

const conn = (ends: Connection["ends"], extra: Partial<Connection> = {}): Connection => ({ id: "c", ends, ...extra });

describe("connectionShape bands", () => {
	it("merges adjacent numeric rows into one band", () => {
		const lookup = lookupOf({ "0": { "1": 0, "2": 1, "3": 2 }, "1": { "1": 0, "2": 1, "3": 2 } });
		const shape = connectionShape(conn([{ column: "0", items: ["1", "2", "3"] }, { column: "1", items: ["1", "2", "3"] }]), columns, lookup);
		const leftBands = shape?.bands.filter((b) => b.column === "0") ?? [];
		expect(leftBands.length).toBe(1);
	});

	it("merges adjacent STRING ids too (tree paths, git hunks)", () => {
		const lookup = lookupOf({ "0": { "src/a.ts": 0, "src/b.ts": 1 }, "1": { "src/a.ts": 0, "src/b.ts": 1 } });
		const shape = connectionShape(conn([{ column: "0", items: ["src/a.ts", "src/b.ts"] }, { column: "1", items: ["src/a.ts", "src/b.ts"] }]), columns, lookup);
		expect(shape?.bands.filter((b) => b.column === "0").length).toBe(1);
	});

	it("a gap between rows splits the band", () => {
		const lookup = lookupOf({ "0": { "1": 0, "5": 5 }, "1": { "1": 0, "5": 5 } });
		const shape = connectionShape(conn([{ column: "0", items: ["1", "5"] }, { column: "1", items: ["1", "5"] }]), columns, lookup);
		expect(shape?.bands.filter((b) => b.column === "0").length).toBe(2);
	});

	it("a differs row splits the band by tone", () => {
		const lookup = lookupOf({ "0": { "1": 0, "2": 1, "3": 2 }, "1": { "1": 0, "2": 1, "3": 2 } });
		const toneOf = (column: string, id: string) => (column === "0" && id === "2" ? "differs" : null);
		const shape = connectionShape(conn([{ column: "0", items: ["1", "2", "3"] }, { column: "1", items: ["1", "2", "3"] }]), columns, lookup, 0, toneOf);
		const leftBands = shape?.bands.filter((b) => b.column === "0") ?? [];
		expect(leftBands.length).toBe(3);
		expect(leftBands.some((b) => b.tone === "differs")).toBe(true);
	});

	it("returns null when an end has no measured row", () => {
		const lookup = lookupOf({ "0": { "1": 0 }, "1": {} });
		expect(connectionShape(conn([{ column: "0", items: ["1"] }, { column: "1", items: ["9"] }]), columns, lookup)).toBeNull();
	});
});

describe("connectionShape ribbons", () => {
	it("draws a ribbon between two columns", () => {
		const lookup = lookupOf({ "0": { "1": 0 }, "1": { "1": 0 } });
		const shape = connectionShape(conn([{ column: "0", items: ["1"] }, { column: "1", items: ["1"] }]), columns, lookup);
		expect(shape?.ribbons.length).toBe(1);
		expect(shape?.ribbons[0]?.path).toContain("M");
	});

	it("draws ribbons across three columns (3-way merge)", () => {
		const three: RibbonColumn[] = [...columns, { id: "2", box: { top: 0, bottom: 1000, left: 400, right: 500 } }];
		const lookup = lookupOf({ "0": { "1": 0 }, "1": { "1": 0 }, "2": { "1": 0 } });
		const shape = connectionShape(conn([{ column: "0", items: ["1"] }, { column: "1", items: ["1"] }, { column: "2", items: ["1"] }]), three, lookup);
		expect(shape?.ribbons.length).toBe(2);
	});
});

describe("connectionShape tone coherence", () => {
	it("a lane takes the tone of the rows it joins (no red road over green bands)", () => {
		const lookup = lookupOf({ "0": { "1": 0 }, "1": { "1": 0 } });
		// The owner labelled the lane `same`, but every row it names is `differs`.
		const toneOf = () => "differs";
		const shape = connectionShape(conn([{ column: "0", items: ["1"] }, { column: "1", items: ["1"] }], { tone: "same" }), columns, lookup, 0, toneOf);
		expect(shape?.tone).toBe("differs");
	});

	it("keeps the owner's tone when the rows disagree", () => {
		const lookup = lookupOf({ "0": { "1": 0, "2": 1 }, "1": { "1": 0, "2": 1 } });
		const toneOf = (column: string, id: string) => (id === "1" ? "differs" : "same");
		const shape = connectionShape(conn([{ column: "0", items: ["1", "2"] }, { column: "1", items: ["1", "2"] }], { tone: "same" }), columns, lookup, 0, toneOf);
		expect(shape?.tone).toBe("same");
	});

	it("keeps the owner's tone when no row carries one", () => {
		const lookup = lookupOf({ "0": { "1": 0 }, "1": { "1": 0 } });
		const shape = connectionShape(conn([{ column: "0", items: ["1"] }, { column: "1", items: ["1"] }], { tone: "same" }), columns, lookup, 0, () => null);
		expect(shape?.tone).toBe("same");
	});
});

describe("shapesOf dip containment", () => {
	it("never pushes a ribbon below the board's columns", () => {
		// A short board (bottom = 200) with many lanes over the same rows: the slot
		// allocator would dip later lanes far down, but they must stay inside the board.
		const short: RibbonColumn[] = [
			{ id: "0", box: { top: 0, bottom: 200, left: 0, right: 100 } },
			{ id: "1", box: { top: 0, bottom: 200, left: 200, right: 300 } },
		];
		const lookup = lookupOf({ "0": { "1": 0, "2": 1 }, "1": { "1": 0, "2": 1 } });
		const conns: Connection[] = Array.from({ length: 12 }, (_, i) => ({
			id: `c${i}`,
			ends: [{ column: "0", items: ["1", "2"] }, { column: "1", items: ["1", "2"] }],
		}));
		const placed = shapesOf(conns, short, lookup);
		for (const { shape } of placed) {
			expect(shape.ribbon).not.toBeNull();
			expect(shape.ribbon!.bottom).toBeLessThanOrEqual(200);
		}
	});
});
