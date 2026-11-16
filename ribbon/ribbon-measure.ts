import type { Box } from "../rows/row-types.js";
import type { Ribbon, RibbonConnector, MeasuredRibbon } from "./ribbon-types.js";
import type { AnchorLookup } from "../surface/surface-types.js";
import { waistOf, waistPath, type WaistInput } from "./ribbon-waist.js";

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

/** A measured end: its real row boxes, gathered into contiguous blocks. */
interface MeasuredEnd {
	readonly column: string;
	readonly blocks: readonly Box[];
	readonly box: Box | null;
}

/** The knobs every pair measurement shares: the measure args' geometry half. */
type PairContext = Pick<MeasureArgs, "columns" | "rowHeight"> & { readonly shift: number };

/** Gather measured ids into contiguous blocks by visual adjacency. */
const blocksOf = (boxes: readonly Box[]): Box[] => {
	const sorted = [...boxes].sort((a, b) => a.top - b.top);
	const out: Box[] = [];
	for (const box of sorted) {
		const last = out[out.length - 1];
		if (last !== undefined && box.top <= last.bottom + ADJACENT) {
			out[out.length - 1] = { top: Math.min(last.top, box.top), bottom: Math.max(last.bottom, box.bottom), left: Math.min(last.left, box.left), right: Math.max(last.right, box.right) };
		} else out.push({ ...box });
	}
	return out;
};

const endBox = (boxes: readonly Box[]): Box => ({
	top: Math.min(...boxes.map((b) => b.top)),
	bottom: Math.max(...boxes.map((b) => b.bottom)),
	left: Math.min(...boxes.map((b) => b.left)),
	right: Math.max(...boxes.map((b) => b.right)),
});

/** A closed filled band between two boxes: top edge curves across, bottom back. */
const connectorPath = (a: Box, ax: number, b: Box, bx: number): string => {
	const mid = round((ax + bx) / 2);
	return [
		`M ${round(ax)} ${round(a.top)}`,
		`C ${mid} ${round(a.top)} ${mid} ${round(b.top)} ${round(bx)} ${round(b.top)}`,
		`L ${round(bx)} ${round(b.bottom)}`,
		`C ${mid} ${round(b.bottom)} ${mid} ${round(a.bottom)} ${round(ax)} ${round(a.bottom)}`,
		"Z",
	].join(" ");
};

/** Only REAL row boxes anchor a ribbon: a fold's zero-height point is not a row. */
const realBoxes = (end: { column: string; rows?: readonly (string | number)[] }, lookup: AnchorLookup): Box[] =>
	(end.rows ?? [])
		.map((id) => lookup(end.column, String(id)))
		.filter((b): b is Box => b !== null && b.bottom - b.top > 0.5);

/** The ribbon's ends in column order, each with its measured blocks. */
const measureEnds = (ribbon: Ribbon, columns: readonly RibbonColumnBox[], lookup: AnchorLookup): MeasuredEnd[] => {
	const orderOf = (id: string): number => columns.findIndex((c) => c.id === id);
	return (ribbon.ends ?? [])
		.map((end) => ({ end, order: orderOf(end.column) }))
		.filter((e) => e.order >= 0)
		.sort((a, b) => a.order - b.order)
		.map(({ end }) => {
			const boxes = realBoxes(end, lookup);
			return { column: end.column, blocks: blocksOf(boxes), box: boxes.length > 0 ? endBox(boxes) : null };
		})
		.filter((e) => e.box !== null);
};

/** The waist inputs for a pair of ends (the corridor the label rides). */
const waistInputOf = (left: MeasuredEnd, right: MeasuredEnd, ctx: PairContext, labelWidth: number): WaistInput | null => {
	if (left.box === null || right.box === null) return null;
	const boxOfColumn = (id: string): Box | null => ctx.columns.find((c) => c.id === id)?.box ?? null;
	const ax = boxOfColumn(left.column)?.right ?? left.box.right;
	const bx = boxOfColumn(right.column)?.left ?? right.box.left;
	return { a: left.box, b: right.box, ax, bx, rowHeight: ctx.rowHeight, labelWidth, shift: ctx.shift };
};

/** One connector between neighbouring ends: a waist for two ends, a band for N. */
const connectorOf = (left: MeasuredEnd, right: MeasuredEnd, ctx: PairContext, label: { width: number; twoEnds: boolean }): RibbonConnector | null => {
	const input = waistInputOf(left, right, ctx, label.width);
	if (input === null || left.box === null || right.box === null) return null;
	if (label.twoEnds) {
		const waist = waistOf(input);
		return { from: left.column, to: right.column, path: waistPath(input, waist), height: round(waist.half * 2), cx: waist.midX, cy: waist.nodeY };
	}
	const { ax, bx } = input;
	const height = Math.max(left.box.bottom - left.box.top, right.box.bottom - right.box.top, ctx.rowHeight);
	return { from: left.column, to: right.column, path: connectorPath(left.box, ax, right.box, bx), height: round(height), cx: round((ax + bx) / 2), cy: round((Math.max(left.box.top, right.box.top) + Math.min(left.box.bottom, right.box.bottom)) / 2) };
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

/** A one-ended ribbon (an added/removed member) gets a STUB: a short tongue
 *  from its row's corridor edge into the corridor, so absence is visible too. */
/** Which way the corridor lies from a lone end: towards the nearest other
 *  column, or away from the board edge when there is none. */
const stubSide = (colBox: Box, columns: readonly RibbonColumnBox[], own: string): boolean => {
	const centre = (colBox.left + colBox.right) / 2;
	const others = columns.filter((c): c is { id: string; box: Box } => c.id !== own && c.box !== null);
	if (others.length === 0) return colBox.left <= centre;
	const nearest = others.reduce((best, c) => (Math.abs(c.box.left - centre) < Math.abs(best.box.left - centre) ? c : best));
	return nearest.box.left > colBox.right;
};

const stubOf = (end: MeasuredEnd, columns: readonly RibbonColumnBox[], rowHeight: number): RibbonConnector | null => {
	const colBox = columns.find((c) => c.id === end.column)?.box;
	if (end.box === null || colBox == null) return null;
	const toRight = stubSide(colBox, columns, end.column);
	const ax = toRight ? colBox.right : colBox.left;
	const bx = ax + (toRight ? 14 : -14);
	const stubBox: Box = { top: end.box.top, bottom: Math.min(end.box.bottom, end.box.top + rowHeight), left: Math.min(ax, bx), right: Math.max(ax, bx) };
	return { from: end.column, to: end.column, path: connectorPath(stubBox, ax, stubBox, bx), height: round(stubBox.bottom - stubBox.top), cx: round((ax + bx) / 2), cy: round((stubBox.top + stubBox.bottom) / 2) };
};

export interface MeasureArgs {
	readonly ribbon: Ribbon;
	readonly columns: readonly RibbonColumnBox[];
	readonly lookup: AnchorLookup;
	readonly rowHeight: number;
	/** Moves the two-column waist down (slot allocation); ends stay put. */
	readonly shift?: number;
}

/** The measured row washes of every end (kept for geometry; the backdrop no
 *  longer paints them — ribbons and word marks carry the comparison). */
const bandsOf = (ends: readonly MeasuredEnd[], ribbon: Ribbon): MeasuredRibbon["bands"] =>
	ends.flatMap((end) => end.blocks.map((block) => ({ column: end.column, top: block.top, bottom: block.bottom, ...(ribbon.tone === undefined ? {} : { tone: ribbon.tone }) })));

/** A lone end's shape: one stub into the corridor, no caption (an added or
 *  removed member is part of the comparison, not invisible). */
const stubShape = (ribbon: Ribbon, first: MeasuredEnd, ctx: PairContext, bands: MeasuredRibbon["bands"]): MeasuredRibbon => {
	const stub = stubOf(first, ctx.columns, ctx.rowHeight);
	return { id: ribbon.id, tone: ribbon.tone ?? "duplicate", label: ribbon.label ?? null, bands, connectors: stub === null ? [] : [stub], caption: null, box: null };
};

/**
 * Measure one ribbon. Returns null when NO end is on screen. Two or more ends
 * draw connectors between them; a single end draws a stub into the corridor.
 */
export const measureRibbon = ({ ribbon, columns, lookup, rowHeight, shift = 0 }: MeasureArgs): MeasuredRibbon | null => {
	const ends = measureEnds(ribbon, columns, lookup);
	const first = ends[0];
	if (first === undefined) return null;
	const bands = bandsOf(ends, ribbon);
	const ctx: PairContext = { columns, rowHeight, shift };
	if (ends.length === 1) return stubShape(ribbon, first, ctx, bands);
	const labelWidth = (ribbon.label?.length ?? 0) * 6;
	const { caption, box } = captionOf(ends, ctx, labelWidth);
	return { id: ribbon.id, tone: ribbon.tone ?? "duplicate", label: ribbon.label ?? null, bands, connectors: connectorsOf(ends, ctx, labelWidth), caption, box };
};
