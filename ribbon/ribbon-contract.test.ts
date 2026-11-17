// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { measureRibbon, type RibbonColumnBox } from "../../ribbon/ribbon-measure.js";
import { sceneOf } from "../../ribbon/ribbon-scene.js";
import type { RibbonContext } from "../../ribbon/ribbon-context.js";
import type { ToneApi } from "../../ribbon/hooks/use-ribbon-tone.js";
import type { Column } from "../../columns/column-types.js";
import type { Ribbon } from "../../ribbon/ribbon-types.js";
import type { Box } from "../../rows/row-types.js";
import type { AnchorLookup } from "../../surface/surface-types.js";

// THE RIBBON IS ONE ENTITY (user's rule): a single unbroken path that covers
// its rows AND the corridor between them. There are no separate "bands", no
// "ends" as independent highlights — the ribbon's own body covers the rows.
// A one-sided member is ONE path: its row + a tongue into the corridor.

const ROW = 18;
const box = (top: number, left: number, right: number): Box => ({ top, bottom: top + ROW - 2, left, right });
const columns: RibbonColumnBox[] = [
	{ id: "0", box: { top: 0, bottom: 1000, left: 0, right: 100 } },
	{ id: "1", box: { top: 0, bottom: 1000, left: 200, right: 300 } },
];
const lookupOf = (pos: Record<string, Record<string, number>>): AnchorLookup => (column, id) => {
	const row = pos[column]?.[id];
	return row === undefined ? null : box(row * ROW, column === "0" ? 0 : 200, column === "0" ? 100 : 300);
};
const chain: Ribbon = { id: "c", tone: "duplicate", ends: [{ column: "0", rows: ["1"] }, { column: "1", rows: ["1"] }] };
const two = lookupOf({ "0": { "1": 0 }, "1": { "1": 0 } });
const measure = (ribbon: Ribbon, lookup: AnchorLookup, shift = 0) =>
	measureRibbon({ ribbon, columns, lookup, rowHeight: ROW, shift });

const xsOf = (path: string): number[] => path.split(/[MCZL]\s*/).flatMap((piece) => {
	const parts = piece.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
	const out: number[] = [];
	for (let i = 0; i + 1 < parts.length; i += 2) out.push(parts[i] ?? 0);
	return out;
});
const ysOf = (path: string): number[] => path.split(/[MCZL]\s*/).flatMap((piece) => {
	const parts = piece.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
	const out: number[] = [];
	for (let i = 0; i + 1 < parts.length; i += 2) out.push(parts[i + 1] ?? 0);
	return out;
});

const color = { fill: "rgba(1,2,3,0.2)", hot: "rgba(1,2,3,0.4)" };
const tone: ToneApi = { toneOf: () => "duplicate", colorOfKey: () => color, fillOf: () => color.fill, hotOf: () => color.hot };
const cols: Column[] = [{ id: "0", rows: [{ id: "1", text: "a" }] }, { id: "1", rows: [{ id: "1", text: "a" }] }];
const ctxOf = (over: Partial<RibbonContext>): RibbonContext => ({
	ribbons: [chain], columns: cols, columnBoxes: columns, lookup: two, rowHeight: ROW, tone, hotRibbon: null, hotRows: new Set<string>(), ...over,
});

describe("the ribbon is ONE entity", () => {
	it("has no separate bands — the shape carries only connectors", () => {
		const shape = measure(chain, two);
		expect(shape).not.toBeNull();
		expect("bands" in (shape ?? {})).toBe(false);
	});

	it("its ONE path covers the left row to the outer edge and the right row to the outer edge", () => {
		const shape = measure(chain, two);
		expect(shape?.connectors.length).toBe(1);
		const xs = xsOf(shape?.connectors[0]?.path ?? "");
		expect(Math.min(...xs)).toBe(0); // left column outer edge
		expect(Math.max(...xs)).toBe(300); // right column outer edge
	});

	it("the path is closed and unbroken (single Z)", () => {
		const shape = measure(chain, two);
		const d = shape?.connectors[0]?.path ?? "";
		expect(d.trim().endsWith("Z")).toBe(true);
		expect((d.match(/Z/g) ?? []).length).toBe(1);
		expect((d.match(/M/g) ?? []).length).toBe(1);
	});

	it("a one-sided member is ONE path: row body + corridor + thin inter-line into the opposite column", () => {
		const shape = measure(chain, lookupOf({ "0": { "1": 0 }, "1": {} }));
		expect(shape?.connectors.length).toBe(1);
		const d = shape?.connectors[0]?.path ?? "";
		expect((d.match(/M/g) ?? []).length).toBe(1);
		const xs = xsOf(d);
		expect(Math.min(...xs)).toBe(0); // covers its row from the outer edge
		expect(Math.max(...xs)).toBe(300); // micro-line reaches the opposite column's far edge
		// The continuation inside the opposite column is a 2px hairline BETWEEN rows.
		const ys = ysOf(d);
		const inOpp = xs.map((x, i) => ({ x, y: ys[i] ?? 0 })).filter((p) => p.x > 200);
		const oppYs = inOpp.map((p) => p.y);
		expect(Math.max(...oppYs) - Math.min(...oppYs)).toBeLessThanOrEqual(2);
	});

	it("the waist shifts only the middle; the row coverage stays on the rows", () => {
		const natural = measure(chain, two);
		const shifted = measure(chain, two, 90);
		const ysN = ysOf(natural?.connectors[0]?.path ?? "");
		const ysS = ysOf(shifted?.connectors[0]?.path ?? "");
		expect(Math.min(...ysN)).toBe(Math.min(...ysS)); // top row edge unchanged
		expect(Math.max(...ysS)).toBeGreaterThan(Math.max(...ysN)); // plateau moved down
	});

	it("the scene emits no band elements, standing or hot", () => {
		for (const hot of [null, "c"]) {
			const scene = sceneOf(ctxOf({ hotRibbon: hot }));
			expect(scene.hints.length).toBe(0);
		}
	});

	it("the caption rides the plateau inside the corridor box", () => {
		const labelled: Ribbon = { ...chain, label: "dup" };
		const shape = measure(labelled, two, 40);
		expect(shape?.caption).not.toBeNull();
		expect(shape?.box).not.toBeNull();
		const cap = shape?.caption;
		const road = shape?.box;
		if (cap && road) {
			expect(cap.y).toBeGreaterThanOrEqual(road.top);
			expect(cap.y).toBeLessThanOrEqual(road.bottom + 2);
		}
	});
});
