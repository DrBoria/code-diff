import type { Box } from "../rows/row-types.js";
import type { Ribbon, RibbonConnector, MeasuredRibbon } from "./ribbon-types.js";
import type { AnchorLookup } from "../surface/surface-types.js";
import type { RibbonColumnBox } from "./ribbon-measure.js";

/**
 * ── THE ONE-SIDED RIBBON ───────────────────────────────────────────────────
 *
 * A member that exists on ONE side only is still ONE ribbon: its body covers
 * its own row, then — starting AT the corridor edge, with the SAME smooth
 * curve as a normal ribbon's waist — narrows into a THIN INTER-LINE micro-line
 * (WebStorm style) that continues into the OPPOSITE column and hugs the block
 * it belongs to: the gap ABOVE the block's last row when the member sits below
 * the block, the gap BELOW its first row when above. BETWEEN rows, never over.
 */

const round = (v: number): number => Math.round(v * 10) / 10;
/** The micro-line's thickness between rows (WebStorm hairline). */
const MICRO = 2;

/** Which way the corridor lies from a lone end: towards the nearest other
 *  column, or away from the board edge when there is none. */
const stubSide = (colBox: Box, columns: readonly RibbonColumnBox[], own: string): boolean => {
	const centre = (colBox.left + colBox.right) / 2;
	const others = columns.filter((c): c is { id: string; box: Box } => c.id !== own && c.box !== null);
	if (others.length === 0) return colBox.left <= centre;
	const nearest = others.reduce((best, c) => (Math.abs(c.box.left - centre) < Math.abs(best.box.left - centre) ? c : best));
	return nearest.box.left > colBox.right;
};

/** The opposite column's box (where the micro-line continues), or null. */
const oppositeBox = (colBox: Box, columns: readonly RibbonColumnBox[], own: string): Box | null => {
	const others = columns.filter((c): c is { id: string; box: Box } => c.id !== own && c.box !== null);
	if (others.length === 0) return null;
	const centre = (colBox.left + colBox.right) / 2;
	return others.reduce((best, c) => (Math.abs(c.box.left - centre) < Math.abs(best.box.left - centre) ? c : best)).box;
};

export interface StubArgs {
	readonly end: { column: string; box: Box | null };
	readonly columns: readonly RibbonColumnBox[];
	readonly rowHeight: number;
	/** Y of the inter-line gap hugging the opposite block (between rows). */
	readonly gapY?: number;
}

/** The lone-column tongue (no opposite column on screen). */
interface TongueArgs {
	readonly column: string;
	readonly outer: number;
	readonly ax: number;
	readonly toRight: boolean;
	readonly top: number;
	readonly bottom: number;
}

const tongue = ({ column, outer, ax, toRight, top, bottom }: TongueArgs): RibbonConnector => {
	const bx = ax + (toRight ? 14 : -14);
	const path = [`M ${round(outer)} ${top}`, `L ${round(bx)} ${top}`, `L ${round(bx)} ${bottom}`, `L ${round(outer)} ${bottom}`, "Z"].join(" ");

	return { from: column, to: column, path, height: round(bottom - top), cx: round((ax + bx) / 2), cy: round((top + bottom) / 2) };
};

export const stubOf = ({ end, columns, rowHeight, gapY }: StubArgs): RibbonConnector | null => {
	const colBox = columns.find((c) => c.id === end.column)?.box;
	if (end.box === null || colBox == null) return null;
	const toRight = stubSide(colBox, columns, end.column);
	const ax = toRight ? colBox.right : colBox.left;
	const outer = toRight ? colBox.left : colBox.right;
	const top = round(end.box.top);
	const bottom = round(Math.min(end.box.bottom, end.box.top + rowHeight));
	const opp = oppositeBox(colBox, columns, end.column);
	if (opp === null) return tongue({ column: end.column, outer, ax, toRight, top, bottom });
	const oppEdge = toRight ? opp.left : opp.right;
	const oppFar = toRight ? opp.right : opp.left;
	// The micro-line hugs the block: given gap Y, else the gap under the row.
	const microY = round(gapY ?? bottom + 1);
	const mTop = round(microY - MICRO / 2);
	const mBot = round(microY + MICRO / 2);
	// Smooth taper: the SAME cubic run as the normal waist (0.45 of the span),
	// starting at the corridor edge — the ribbon narrows gradually, not at an
	// abrupt angle at the opposite column.
	const run = (oppEdge - ax) * 0.45;
	const c1 = round(ax + run);
	const c2 = round(oppEdge - run);
	const path = [
		`M ${round(outer)} ${top}`,
		`L ${round(ax)} ${top}`,
		`C ${c1} ${top} ${c2} ${mTop} ${round(oppEdge)} ${mTop}`,
		`L ${round(oppFar)} ${mTop}`,
		`L ${round(oppFar)} ${mBot}`,
		`L ${round(oppEdge)} ${mBot}`,
		`C ${c2} ${mBot} ${c1} ${bottom} ${round(ax)} ${bottom}`,
		`L ${round(outer)} ${bottom}`,
		"Z",
	].join(" ");
	return { from: end.column, to: end.column, path, height: round(bottom - top), cx: round((ax + oppEdge) / 2), cy: round((top + bottom) / 2) };
};

/** The inter-line gap Y a gap-end names in its column: `before` a row → the
 *  gap ABOVE that row (hugging the block from below); `after` → the gap BELOW
 *  (hugging from above). Null when the anchor row is not on screen. */
const gapYOf = (ribbon: Ribbon, ownColumn: string, lookup: AnchorLookup): number | undefined => {
	for (const end of ribbon.ends ?? []) {
		if (end.column === ownColumn || end.gap === undefined) continue;
		if (end.gap.before !== undefined) {
			const box = lookup(end.column, String(end.gap.before));
			if (box !== null) return box.top - 1;
		}
		if (end.gap.after !== undefined) {
			const box = lookup(end.column, String(end.gap.after));
			if (box !== null) return box.bottom + 1;
		}
	}
	return undefined;
};

/** A lone end's shape: ONE ribbon — its row body, the corridor, and a thin
 *  inter-line continuation into the opposite column, hugging the block. */
export const stubShape = ({ ribbon, first, columns, rowHeight, lookup }: { ribbon: Ribbon; first: { column: string; box: Box | null }; columns: readonly RibbonColumnBox[]; rowHeight: number; lookup: AnchorLookup }): MeasuredRibbon => {
	const stub = stubOf({ end: first, columns, rowHeight, gapY: gapYOf(ribbon, first.column, lookup) });
	return { id: ribbon.id, tone: ribbon.tone ?? "duplicate", label: ribbon.label ?? null, connectors: stub === null ? [] : [stub], caption: null, box: null };
};

