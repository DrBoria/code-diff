// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { measureRibbon, type RibbonColumnBox } from "../../ribbon/ribbon-measure.js";
import { positionRibbons } from "../../ribbon/hooks/use-ribbon-position.js";
import { sceneOf } from "../../ribbon/ribbon-scene.js";
import type { RibbonContext } from "../../ribbon/ribbon-context.js";
import type { ToneApi } from "../../ribbon/hooks/use-ribbon-tone.js";
import type { Column } from "../../columns/column-types.js";
import type { Ribbon } from "../../ribbon/ribbon-types.js";
import type { Box } from "../../rows/row-types.js";
import type { AnchorLookup } from "../../surface/surface-types.js";

// THE RIBBON CONTRACT — executable, not prose. A ribbon is ONE CONTINUOUS
// filled strip: every measured end has a row-height band, neighbouring ends
// are joined, bands and road share one tone, captions ride the road, hints
// are strips too, and washes NEVER cover rows outside the chain. Deleting
// any of this breaks the contract and the build goes red — a reinterpretation
// of a complaint is not a licence to remove a rule.

const ROW = 18;
const box = (top: number, left = 0, right = 100): Box => ({ top, bottom: top + ROW - 2, left, right });
const columns: RibbonColumnBox[] = [
	{ id: "0", box: { top: 0, bottom: 1000, left: 0, right: 100 } },
	{ id: "1", box: { top: 0, bottom: 1000, left: 200, right: 300 } },
];
const lookupOf = (pos: Record<string, Record<string, number>>): AnchorLookup => (column, id) => {
	const row = pos[column]?.[id];
	return row === undefined ? null : box(row * ROW);
};
const chain: Ribbon = { id: "c", tone: "duplicate", ends: [{ column: "0", rows: ["1"] }, { column: "1", rows: ["1"] }] };
const two = lookupOf({ "0": { "1": 0 }, "1": { "1": 0 } });
const measure = (ribbon: Ribbon, lookup: AnchorLookup, shift = 0) =>
	measureRibbon({ ribbon, columns, lookup, rowHeight: ROW, shift });

/** Every vertical extent named by a path's commands (top and bottom edges). */
const ysOf = (path: string): number[] => path.split(/[MCZL]\s*/).flatMap((piece) => {
	const parts = piece.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
	return parts.length >= 2 ? [parts[1] ?? 0, parts[parts.length - 1] ?? 0] : [];
});

const color = { fill: "rgba(1,2,3,0.2)", hot: "rgba(1,2,3,0.4)" };
const tone: ToneApi = { toneOf: () => "duplicate", colorOfKey: () => color, fillOf: () => color.fill, hotOf: () => color.hot };
const cols: Column[] = [{ id: "0", rows: [{ id: "1", text: "a" }, { id: "2", text: "b" }] }, { id: "1", rows: [{ id: "1", text: "a" }, { id: "2", text: "b" }] }];
const ctxOf = (over: Partial<RibbonContext>): RibbonContext => ({
	ribbons: [chain], columns: cols, columnBoxes: columns, lookup: two, rowHeight: ROW, tone, hotRibbon: null, hotRows: new Set<string>(), ...over,
});

describe("contract: the ribbon is one continuous strip", () => {
	it("every measured end keeps a band at least one row tall", () => {
		const shape = measure(chain, two);
		expect(shape?.bands.length).toBe(2);
		for (const band of shape?.bands ?? []) expect(band.bottom - band.top).toBeGreaterThanOrEqual(ROW - 2);
	});

	it("bands cover EXACTLY the chain's rows — never a row outside it", () => {
		const tall: Ribbon = { id: "t", ends: [{ column: "0", rows: ["1", "2", "3"] }, { column: "1", rows: ["1"] }] };
		const lookup = lookupOf({ "0": { "1": 0, "2": 1, "3": 2, "9": 9 }, "1": { "1": 0 } });
		const shape = measure(tall, lookup);
		for (const band of shape?.bands ?? []) expect(band.bottom).toBeLessThanOrEqual(3 * ROW);
		expect((shape?.bands ?? []).some((b) => b.column === "0" && b.bottom > 2 * ROW)).toBe(true);
	});

	it("a crowded corridor shifts the waist but never the bands", () => {
		const natural = measure(chain, two);
		const shifted = measure(chain, two, 90);
		expect(shifted?.bands).toEqual(natural?.bands);
		expect((shifted?.box?.top ?? 0) - (natural?.box?.top ?? 0)).toBe(90);
	});

	it("N ends: N-1 connectors, no gap between neighbouring ends", () => {
		const three: RibbonColumnBox[] = [...columns, { id: "2", box: { top: 0, bottom: 1000, left: 400, right: 500 } }];
		const lookup = lookupOf({ "0": { "1": 0 }, "1": { "1": 0 }, "2": { "1": 0 } });
		const shape = measureRibbon({ ribbon: { id: "n", ends: [{ column: "0", rows: ["1"] }, { column: "1", rows: ["1"] }, { column: "2", rows: ["1"] }] }, columns: three, lookup, rowHeight: ROW });
		expect(shape?.connectors.length).toBe(2);
		expect(shape?.connectors.map((c) => `${c.from}>${c.to}`)).toEqual(["0>1", "1>2"]);
	});

	it("every path is a CLOSED filled strip — no open strokes", () => {
		const shape = measure(chain, two);
		for (const connector of shape?.connectors ?? []) {
			expect(connector.path.trim().endsWith("Z")).toBe(true);
			expect(connector.height).toBeGreaterThanOrEqual(4);
		}
	});

	it("a one-ended stub is a full row-height strip, not a sliver", () => {
		const shape = measure(chain, lookupOf({ "0": { "1": 0 }, "1": {} }));
		expect(shape?.connectors.length).toBe(1);
		expect(shape?.connectors[0]?.height).toBeGreaterThanOrEqual(ROW - 2);
	});

	it("the caption rides the road: inside the corridor box, shifted with it", () => {
		const labelled: Ribbon = { ...chain, label: "dup" };
		for (const shift of [0, 90]) {
			const shape = measure(labelled, two, shift);
			const cap = shape?.caption;
			const road = shape?.box;
			expect(cap).not.toBeNull();
			expect(road).not.toBeNull();
			if (cap !== null && cap !== undefined && road != null) {
				expect(cap.y).toBeGreaterThanOrEqual(road.top);
				expect(cap.y).toBeLessThanOrEqual(road.bottom + 2);
			}
		}
	});

	it("plateaus never dip below the columns' bottom edge", () => {
		const low: RibbonColumnBox[] = columns.map((c) => ({ id: c.id, box: { top: 0, bottom: 80, left: c.box?.left ?? 0, right: c.box?.right ?? 100 } }));
		const lanes = [0, 1, 2].map((i): Ribbon => ({ id: `l${i}`, ends: [{ column: "0", rows: [String(i + 1)] }, { column: "1", rows: [String(i + 1)] }] }));
		const lookup = lookupOf({ "0": { "1": 0, "2": 1, "3": 2 }, "1": { "1": 0, "2": 1, "3": 2 } });
		const natural = lanes.map((ribbon) => ({ ribbon, shape: measureRibbon({ ribbon, columns: low, lookup, rowHeight: ROW }) })).filter((e): e is { ribbon: Ribbon; shape: NonNullable<ReturnType<typeof measureRibbon>> } => e.shape !== null);
		const placed = positionRibbons(natural, low, (ribbon, shift) => measureRibbon({ ribbon, columns: low, lookup, rowHeight: ROW, shift }));
		for (const entry of placed) {
			for (const connector of entry.shape.connectors) expect(Math.max(...ysOf(connector.path))).toBeLessThanOrEqual(82);
		}
	});
});

describe("contract: one tone, hints are strips, washes stay inside the chain", () => {
	it("standing bands paint the SAME colour as their ribbon's road", () => {
		const scene = sceneOf(ctxOf({}));
		for (const path of scene.bands) expect(path.getAttribute("fill")).toBe(color.fill);
	});

	it("a hot chain's bands paint its ONE hot shade, uniformly", () => {
		const scene = sceneOf(ctxOf({ hotRibbon: "c" }));
		expect(scene.bands.length).toBe(2);
		for (const path of scene.bands) expect(path.getAttribute("fill")).toBe(color.hot);
	});

	it("group hints are row-height strips too, never 2px wires", () => {
		const scene = sceneOf(ctxOf({ hotRows: new Set(["0::2", "1::2"]), lookup: lookupOf({ "0": { "1": 0, "2": 1 }, "1": { "1": 0, "2": 1 } }) }));
		const hints = scene.bands.filter((p) => p.hasAttribute("data-group-hint"));
		expect(hints.length).toBe(2);
		for (const path of scene.bands) {
			const ys = ysOf(path.getAttribute("d") ?? "");
			expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(ROW - 2);
		}
	});

	it("the hot chain's rows are NEVER painted twice (no stacked alpha)", () => {
		const scene = sceneOf(ctxOf({ hotRibbon: "c", hotRows: new Set(["0::1", "1::1"]) }));
		expect(scene.bands.filter((p) => p.hasAttribute("data-group-hint")).length).toBe(0);
		expect(scene.bands.length).toBe(2);
	});
});
