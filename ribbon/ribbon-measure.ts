import type { Box } from "../rows/row-types.js";
import type { Ribbon, RibbonConnector, MeasuredRibbon } from "./ribbon-types.js";
import type { AnchorLookup } from "../surface/surface-types.js";
import { waistOf, waistPath, type WaistInput } from "./ribbon-waist.js";
import { stubShape } from "./ribbon-stub.js";

/**
 * ── RIBBON GEOMETRY ────────────────────────────────────────────────────────
 *
 * Pure math, scene-graph free. A ribbon names row ids; this measures their real
 * boxes and returns closed filled bands + connectors. A connector ALWAYS spans
 * two measured row boxes — its ends never leave their rows. When a corridor is
 * crowded, the POSITION hook shifts the flat middle (waist) down between rows;
 * the caption rides the plateau, so text and road never separate.
 */

const round = (v: number): number => Math.round(v * 10) / 10;
const ADJACENT = 2;

/** A column's measured extent: its identity plus the box it occupies (or null
 *  when it is not on screen). The identity half is shared with every named
 *  column list; the box half is what measuring adds. */
export interface RibbonColumnBox {
	readonly id: string;
	readonly box: Box | null;
}

/** A measured block: its extent plus the row ids it covers. */
interface MeasuredBlock {
	readonly box: Box;
	readonly rows: readonly (string | number)[];
}

/** A measured end: its real row boxes, gathered into contiguous blocks. */
interface MeasuredEnd {
	readonly column: string;
	readonly blocks: readonly MeasuredBlock[];
	readonly box: Box | null;
}

/** The knobs every pair measurement shares: the measure args' geometry half. */
type PairContext = Pick<MeasureArgs, "columns" | "rowHeight"> & { readonly shift: number };

/** Gather measured ids into contiguous blocks by visual adjacency. */
const blocksOf = (boxes: readonly { id: string | number; box: Box }[]): MeasuredBlock[] => {
	const sorted = [...boxes].sort((a, b) => a.box.top - b.box.top);
	const out: MeasuredBlock[] = [];
	for (const { id, box } of sorted) {
		const last = out[out.length - 1];
		if (last !== undefined && box.top <= last.box.bottom + ADJACENT) {
			const merged: Box = { top: Math.min(last.box.top, box.top), bottom: Math.max(last.box.bottom, box.bottom), left: Math.min(last.box.left, box.left), right: Math.max(last.box.right, box.right) };
			out[out.length - 1] = { box: merged, rows: [...last.rows, id] };
		} else out.push({ box: { ...box }, rows: [id] });
	}
	return out;
};

const endBox = (boxes: readonly Box[]): Box => ({
	top: Math.min(...boxes.map((b) => b.top)),
	bottom: Math.max(...boxes.map((b) => b.bottom)),
	left: Math.min(...boxes.map((b) => b.left)),
	right: Math.max(...boxes.map((b) => b.right)),
});

/** ONE closed strip covering both rows (outer edge → outer edge) and the
 *  corridor between them — the N-end connector, same one-entity rule. */
const connectorPath = (a: Box, b: Box, edges: { ax: number; bx: number; al: number; br: number }): string => {
	const { ax, bx, al, br } = edges;
	const mid = round((ax + bx) / 2);
	return [
		`M ${round(al)} ${round(a.top)}`,
		`L ${round(ax)} ${round(a.top)}`,
		`C ${mid} ${round(a.top)} ${mid} ${round(b.top)} ${round(bx)} ${round(b.top)}`,
		`L ${round(br)} ${round(b.top)}`,
		`L ${round(br)} ${round(b.bottom)}`,
		`L ${round(bx)} ${round(b.bottom)}`,
		`C ${mid} ${round(b.bottom)} ${mid} ${round(a.bottom)} ${round(ax)} ${round(a.bottom)}`,
		`L ${round(al)} ${round(a.bottom)}`,
		"Z",
	].join(" ");
};

/** Only REAL row boxes anchor a ribbon: a fold's zero-height point is not a row. */
const realBoxes = (end: { column: string; rows?: readonly (string | number)[] }, lookup: AnchorLookup): { id: string | number; box: Box }[] =>
	(end.rows ?? [])
		.map((id) => ({ id, box: lookup(end.column, String(id)) }))
		.filter((e): e is { id: string | number; box: Box } => e.box !== null && e.box.bottom - e.box.top > 0.5);

/** The ribbon's ends in column order, each with its measured blocks. */
const measureEnds = (ribbon: Ribbon, columns: readonly RibbonColumnBox[], lookup: AnchorLookup): MeasuredEnd[] => {
	const orderOf = (id: string): number => columns.findIndex((c) => c.id === id);
	return (ribbon.ends ?? [])
		.map((end) => ({ end, order: orderOf(end.column) }))
		.filter((e) => e.order >= 0)
		.sort((a, b) => a.order - b.order)
		.map(({ end }) => {
			const boxes = realBoxes(end, lookup);
			return { column: end.column, blocks: blocksOf(boxes), box: boxes.length > 0 ? endBox(boxes.map((b) => b.box)) : null };
		})
		.filter((e) => e.box !== null);
};

/** One end's x-edges: the corridor edge (towards the neighbour) and the outer
 *  column edge the ribbon's row coverage reaches. */
const endEdges = (end: MeasuredEnd, ctx: PairContext, side: "left" | "right"): { corridor: number; outer: number } => {
	const col = ctx.columns.find((c) => c.id === end.column)?.box ?? null;
	const own = end.box ?? { top: 0, bottom: 0, left: 0, right: 0 };
	if (col === null) return side === "left" ? { corridor: own.right, outer: own.left } : { corridor: own.left, outer: own.right };

	return side === "left" ? { corridor: col.right, outer: col.left } : { corridor: col.left, outer: col.right };
};

/** The waist inputs for a pair of ends (the corridor the label rides). */
const waistInputOf = (left: MeasuredEnd, right: MeasuredEnd, ctx: PairContext, labelWidth: number): WaistInput | null => {
	if (left.box === null || right.box === null) return null;
	const le = endEdges(left, ctx, "left");
	const re = endEdges(right, ctx, "right");
	return { a: left.box, b: right.box, ax: le.corridor, bx: re.corridor, al: le.outer, br: re.outer, rowHeight: ctx.rowHeight, labelWidth, shift: ctx.shift };
};

/** One connector between neighbouring ends: ONE unbroken strip covering both
 *  rows and the corridor between them (waist for a pair, straight strip for N). */
const connectorOf = (left: MeasuredEnd, right: MeasuredEnd, ctx: PairContext, label: { width: number; twoEnds: boolean }): RibbonConnector | null => {
	const input = waistInputOf(left, right, ctx, label.width);
	if (input === null || left.box === null || right.box === null) return null;
	if (label.twoEnds) {
		const waist = waistOf(input);
		return { from: left.column, to: right.column, path: waistPath(input, waist), height: round(waist.half * 2), cx: waist.midX, cy: waist.nodeY };
	}
	const { ax, bx } = input;
	const al = input.al ?? ax;
	const br = input.br ?? bx;
	const height = Math.max(left.box.bottom - left.box.top, right.box.bottom - right.box.top, ctx.rowHeight);
	return { from: left.column, to: right.column, path: connectorPath(left.box, right.box, { ax, bx, al, br }), height: round(height), cx: round((ax + bx) / 2), cy: round((Math.max(left.box.top, right.box.top) + Math.min(left.box.bottom, right.box.bottom)) / 2) };
};

/** The caption + corridor box of the first two ends (where the label lives). */
const captionOf = (ends: readonly MeasuredEnd[], ctx: PairContext, labelWidth: number): { caption: { x: number; y: number } | null; box: Box | null } => {
	const first = ends[0];
	const second = ends[1];
	if (first?.box == null || second?.box == null) return { caption: null, box: null };
	const input = waistInputOf(first, second, ctx, labelWidth);
	if (input === null) return { caption: null, box: null };
	if (ends.length === 2) {
		const waist = waistOf(input);
		return { caption: { x: waist.midX, y: round(waist.nodeY - waist.half + 11) }, box: { top: round(waist.nodeY - waist.half), bottom: round(waist.nodeY + waist.half), left: round(input.ax), right: round(input.bx) } };
	}
	return { caption: { x: round((input.ax + input.bx) / 2), y: round(Math.min(first.box.top, second.box.top) + 10) }, box: { top: Math.min(first.box.top, second.box.top), bottom: Math.max(first.box.bottom, second.box.bottom), left: round(input.ax), right: round(input.bx) } };
};

/** Every connector of a measured ribbon, neighbouring end to neighbouring end. */
const connectorsOf = (ends: readonly MeasuredEnd[], ctx: PairContext, labelWidth: number): RibbonConnector[] => {
	const out: RibbonConnector[] = [];
	for (let i = 0; i < ends.length - 1; i += 1) {
		const left = ends[i];
		const right = ends[i + 1];
		if (left === undefined || right === undefined) continue;
		const connector = connectorOf(left, right, ctx, { width: i === 0 ? labelWidth : 0, twoEnds: ends.length === 2 });
		if (connector !== null) out.push(connector);
	}
	return out;
};

export interface MeasureArgs {
	readonly ribbon: Ribbon;
	readonly columns: readonly RibbonColumnBox[];
	readonly lookup: AnchorLookup;
	readonly rowHeight: number;
	/** Moves the two-column waist down (slot allocation); ends stay put. */
	readonly shift?: number;
}

/**
 * Measure one ribbon. Returns null when NO end is on screen. Two or more ends
 * draw ONE unbroken strip across them; a single end draws one strip over its
 * row continuing as an inter-line micro-line to the opposite block.
 */
export const measureRibbon = ({ ribbon, columns, lookup, rowHeight, shift = 0 }: MeasureArgs): MeasuredRibbon | null => {
	const ends = measureEnds(ribbon, columns, lookup);
	const first = ends[0];
	if (first === undefined) return null;
	const ctx: PairContext = { columns, rowHeight, shift };
	if (ends.length === 1) return stubShape({ ribbon, first, columns: ctx.columns, rowHeight: ctx.rowHeight, lookup });
	const labelWidth = (ribbon.label?.length ?? 0) * 6;
	const { caption, box } = captionOf(ends, ctx, labelWidth);
	return { id: ribbon.id, tone: ribbon.tone ?? "duplicate", label: ribbon.label ?? null, connectors: connectorsOf(ends, ctx, labelWidth), caption, box };
};
