import type { Box } from "../rows/row-types.js";

/**
 * ── THE WAIST ──────────────────────────────────────────────────────────────
 *
 * A two-column connector leaves the FULL height of one end, climbs to a flat
 * plateau (where the caption sits), runs straight, then descends to the full
 * height of the other end. The plateau is one row tall at most, so lanes that
 * join the same rows still have room to separate. `shift` moves the flat middle
 * down inside the corridor while BOTH ENDS stay on their rows — the road bends
 * away instead of leaving its bands, and the caption rides the plateau.
 */

const round = (v: number): number => Math.round(v * 10) / 10;

export interface Waist {
	readonly midX: number;
	readonly nodeY: number;
	readonly half: number;
	readonly plateau: number;
}

/** Everything the waist needs: the two end boxes, their corridor edges, knobs. */
export interface WaistInput {
	readonly a: Box;
	readonly b: Box;
	readonly ax: number;
	readonly bx: number;
	readonly rowHeight: number;
	readonly labelWidth?: number;
	readonly shift?: number;
}

const overlapOf = (a: Box, b: Box): number => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

/** Where the flat middle sits and how tall it is. `rowHeight` caps the band. */
export const waistOf = ({ a, b, ax, bx, rowHeight, labelWidth = 0, shift = 0 }: WaistInput): Waist => {
	const midX = round((ax + bx) / 2);
	const top = Math.max(a.top, b.top);
	const overlap = overlapOf(a, b);
	// With a caption the plateau must fit 10px text (≥14px tall).
	const minHalf = labelWidth > 0 ? 7 : 2;
	const maxHalf = round(rowHeight);
	const half = round(Math.min(Math.max(minHalf, overlap / 2), maxHalf));
	const nodeY = round(top + half + shift);
	const span = Math.abs(bx - ax);
	const plateau = Math.max(16, Math.ceil(span * 0.14), Math.ceil((labelWidth + 16) / 2));
	return { midX, nodeY, half, plateau };
};

/** The closed filled band through the waist. One path, filled — never a stroke. */
export const waistPath = ({ a, b, ax, bx }: WaistInput, waist: Waist): string => {
	const { midX, nodeY, half, plateau } = waist;
	const pL = round(midX - plateau);
	const pR = round(midX + plateau);
	const runL = (pL - ax) * 0.45;
	const runR = (bx - pR) * 0.45;
	const nTop = round(nodeY - half);
	const nBot = round(nodeY + half);
	return [
		`M ${round(ax)} ${round(a.top)}`,
		`C ${round(ax + runL)} ${round(a.top)} ${round(pL - runL)} ${nTop} ${pL} ${nTop}`,
		`L ${pR} ${nTop}`,
		`C ${round(pR + runR)} ${nTop} ${round(bx - runR)} ${round(b.top)} ${round(bx)} ${round(b.top)}`,
		`L ${round(bx)} ${round(b.bottom)}`,
		`C ${round(bx - runR)} ${round(b.bottom)} ${round(pR + runR)} ${nBot} ${pR} ${nBot}`,
		`L ${pL} ${nBot}`,
		`C ${round(pL - runL)} ${nBot} ${round(ax + runL)} ${round(a.bottom)} ${round(ax)} ${round(a.bottom)}`,
		"Z",
	].join(" ");
};
