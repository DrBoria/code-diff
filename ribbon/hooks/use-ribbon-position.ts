import type { Ribbon, MeasuredRibbon } from "../ribbon-types.js";
import type { RibbonColumnBox } from "../ribbon-measure.js";
import type { Box } from "../../rows/row-types.js";

/**
 * ── ONE LANE, ONE SLOT ─────────────────────────────────────────────────────
 *
 * A corridor is a vertical strip between two columns, and every lane crossing
 * it needs its own height. Two plateaus in the same slot overlap, and their
 * captions land on the same line — a picture that claims two lanes are one
 * row. So a slot is ALLOCATED:
 *
 *   1. every lane is measured where its rows put it;
 *   2. inside one corridor lanes claim slots in row order; a lane whose plateau
 *      would sit on a taken slot is SHIFTED down until it does not;
 *   3. the shift moves only the flat middle — both ends stay on their rows, and
 *      the caption rides the plateau, so text and road never separate;
 *   4. the shift is capped by the columns' own bottom edge: a plateau may bend
 *      between rows, never into the empty space below the code.
 */

/** A corridor slot: the vertical extent a plateau claims (a Box without x). */
type Slot = Pick<Box, "top" | "bottom">;

const collides = (a: Slot, b: Slot): boolean => a.top < b.bottom && b.top < a.bottom;

/** How far a plateau must move down to stop touching the taken slots. */
const freeShift = (natural: Slot, taken: readonly Slot[]): number => {
	let shift = 0;
	for (;;) {
		const moved: Slot = { top: natural.top + shift, bottom: natural.bottom + shift };
		const blocking = taken.filter((slot) => collides(moved, slot));
		if (blocking.length === 0) return shift;
		shift = Math.max(...blocking.map((slot) => slot.bottom + 2 - natural.top));
	}
};

/** The lowest bottom edge of the columns a shape's connectors touch. */
const ceilingOf = (shape: MeasuredRibbon, columns: readonly RibbonColumnBox[]): number => {
	let ceiling = Infinity;
	for (const connector of shape.connectors) {
		for (const id of [connector.from, connector.to]) {
			const box = columns.find((column) => column.id === id)?.box;
			if (box != null) ceiling = Math.min(ceiling, box.bottom);
		}
	}
	return ceiling;
};

export interface Positioned {
	readonly ribbon: Ribbon;
	readonly shape: MeasuredRibbon;
	/** The shift applied to this lane's plateaus (0 = natural position). */
	readonly shift: number;
}

/**
 * Allocate corridor slots. `measure(shift)` re-measures one ribbon with its
 * plateaus moved; ends never move. Lanes keep their input identity.
 */
export const positionRibbons = (
	measured: readonly { ribbon: Ribbon; shape: MeasuredRibbon }[],
	columns: readonly RibbonColumnBox[],
	measure: (ribbon: Ribbon, shift: number) => MeasuredRibbon | null,
): Positioned[] => {
	const taken = new Map<string, Slot[]>();
	const out: Positioned[] = measured.map((entry) => ({ ...entry, shift: 0 }));
	const order = measured
		.map((entry, at) => ({ at, top: entry.shape.box?.top ?? 0 }))
		.sort((a, b) => a.top - b.top);

	for (const { at } of order) {
		const entry = out[at];
		if (entry === undefined || entry.shape.box === null) continue;
		const corridor = `${Math.round(entry.shape.box.left)}:${Math.round(entry.shape.box.right)}`;
		const slots = taken.get(corridor) ?? [];
		const natural: Slot = { top: entry.shape.box.top, bottom: entry.shape.box.bottom };
		let shift = freeShift(natural, slots);
		// Contain the shift: never below the columns the corridor joins.
		const ceiling = ceilingOf(entry.shape, columns);
		if (Number.isFinite(ceiling)) {
			const height = natural.bottom - natural.top;
			shift = Math.min(shift, Math.max(0, ceiling - height - natural.top));
		}
		if (shift > 0) {
			const moved = measure(entry.ribbon, shift);
			if (moved !== null) out[at] = { ribbon: entry.ribbon, shape: moved, shift };
		}
		const placed = out[at]?.shape.box ?? entry.shape.box;
		slots.push({ top: placed.top, bottom: placed.bottom });
		taken.set(corridor, slots);
	}
	return out;
};
