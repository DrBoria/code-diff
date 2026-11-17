import { describe, expect, it } from "vitest";
import { measureRibbon, type RibbonColumnBox } from "../../ribbon/ribbon-measure.js";
import { positionRibbons } from "../../ribbon/hooks/use-ribbon-position.js";
import type { Ribbon } from "../../ribbon/ribbon-types.js";
import type { Box } from "../../rows/row-types.js";
import type { AnchorLookup } from "../../surface/surface-types.js";

// ONE LANE, ONE SLOT: lanes whose rows coincide must not print their plateaus
// (and captions) on the same line. The position hook shifts the waist down
// between rows; both ends stay on their rows and the caption rides the plateau.

const ROW = 18;
const box = (top: number, left = 0, right = 100): Box => ({ top, bottom: top + ROW - 2, left, right });

const columns: RibbonColumnBox[] = [
	{ id: "0", box: { top: 0, bottom: 1000, left: 0, right: 100 } },
	{ id: "1", box: { top: 0, bottom: 1000, left: 200, right: 300 } },
];

// Four lanes over the SAME two rows — the crowded-corridor case.
const lookup: AnchorLookup = (column, id) => (id === "1" || id === "2" ? box((Number(id) - 1) * ROW, column === "0" ? 0 : 200, column === "0" ? 100 : 300) : null);

const lane = (id: string): Ribbon => ({ id, label: id, tone: "duplicate", ends: [{ column: "0", rows: ["1", "2"] }, { column: "1", rows: ["1", "2"] }] });

const measure = (ribbon: Ribbon, shift: number) => measureRibbon({ ribbon, columns, lookup, rowHeight: ROW, shift });

describe("positionRibbons (slot allocation)", () => {
	const ribbons = [lane("a"), lane("b"), lane("c"), lane("d")];
	// map passes (value, index, array) — take only the ribbon, or the index
	// becomes the shift.
	const natural = ribbons.map((ribbon) => ({ ribbon, shape: measure(ribbon, 0)! }));
	const placed = positionRibbons(natural, columns, measure);

	it("gives every lane its own plateau slot (no two boxes overlap)", () => {
		const boxes = placed.map((p) => p.shape.box!);
		for (let i = 0; i < boxes.length; i += 1) {
			for (let j = i + 1; j < boxes.length; j += 1) {
				const a = boxes[i]!;
				const b = boxes[j]!;
				const overlaps = a.top < b.bottom && b.top < a.bottom;
				expect(overlaps).toBe(false);
			}
		}
	});

	it("captions ride the plateau — no two captions share a line", () => {
		const ys = placed.map((p) => p.shape.caption!.y);
		for (let i = 0; i < ys.length; i += 1) {
			for (let j = i + 1; j < ys.length; j += 1) {
				expect(Math.abs(ys[i]! - ys[j]!)).toBeGreaterThanOrEqual(12);
			}
		}
	});

	it("the ribbon's row coverage stays at the measured rows", () => {
		for (const p of placed) {
			for (const connector of p.shape.connectors) {
				const ys = connector.path.split(/[MCZL]\s*/).flatMap((piece) => {
					const parts = piece.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
					return parts.length >= 2 ? [parts[1] ?? 0] : [];
				});
				expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
				expect(Math.min(...ys)).toBeLessThanOrEqual(2 * ROW);
			}
		}
	});

	it("the shift never pushes a plateau below the columns' bottom", () => {
		for (const p of placed) {
			expect(p.shape.box!.bottom).toBeLessThanOrEqual(1000);
		}
	});

	it("a lone lane keeps its natural position (shift 0)", () => {
		const single = positionRibbons([{ ribbon: lane("solo"), shape: measure(lane("solo"), 0)! }], columns, measure);
		expect(single[0]?.shift).toBe(0);
	});
});
