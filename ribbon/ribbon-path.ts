import type { Box } from "../rows/row-types.js";
import type { Ribbon, RibbonConnector, MeasuredRibbon } from "./ribbon-types.js";
import type { AnchorLookup } from "../surface/surface-types.js";

/**
 * ── RIBBON GEOMETRY ────────────────────────────────────────────────────────
 *
 * Pure math, scene-graph free. A ribbon names row ids; this measures their real
 * boxes and returns closed filled bands + connectors. A connector ALWAYS spans
 * two measured row boxes — there is no vertical "dip" into empty space, so a
 * ribbon can never point into the void. Conflicts in a corridor are resolved by
 * horizontal packing of captions, never by moving a band off its rows.
 */

const round = (v: number): number => Math.round(v * 10) / 10;
const ADJACENT = 2;

export interface RibbonColumnBox {
	readonly id: string;
	readonly box: Box | null;
}

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

/** A filled rectangle behind a run of rows, over the whole column width. */
const bandRect = (top: number, bottom: number, left: number, right: number): string =>
	`M ${round(left)} ${round(top)} L ${round(right)} ${round(top)} L ${round(right)} ${round(bottom)} L ${round(left)} ${round(bottom)} Z`;

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

/**
 * Measure one ribbon. Returns null when fewer than two ends are on screen — a
 * ribbon is only drawn between ends that both exist, never into empty space.
 */
export const measureRibbon = (ribbon: Ribbon, columns: readonly RibbonColumnBox[], lookup: AnchorLookup, rowHeight: number): MeasuredRibbon | null => {
	const orderOf = (id: string): number => columns.findIndex((c) => c.id === id);
	const boxOfColumn = (id: string): Box | null => columns.find((c) => c.id === id)?.box ?? null;

	const ends = (ribbon.ends ?? [])
		.map((end) => ({ end, order: orderOf(end.column) }))
		.filter((e) => e.order >= 0)
		.sort((a, b) => a.order - b.order)
		.map(({ end }) => {
			// Only REAL row boxes anchor a ribbon. A folded run's hidden ids measure as
			// zero-height points at the fold button; including them stretched the band
			// into a tall wedge pointing below the content ("a ribbon into the void").
			// A ribbon attaches to the rows that are actually on screen — never to a
			// fold's collapsed point, and never into empty space.
			const boxes = (end.rows ?? [])
				.map((id) => lookup(end.column, String(id)))
				.filter((b): b is Box => b !== null && b.bottom - b.top > 0.5);
			return { column: end.column, boxes, blocks: blocksOf(boxes), box: boxes.length > 0 ? endBox(boxes) : null };
		})
		.filter((e) => e.box !== null);

	if (ends.length < 2) return null;

	const bands: { column: string; top: number; bottom: number; tone?: string }[] = [];
	for (const end of ends) {
		const colBox = boxOfColumn(end.column);
		for (const block of end.blocks) {
			bands.push({ column: end.column, top: block.top, bottom: block.bottom, ...(ribbon.tone === undefined ? {} : { tone: ribbon.tone }) });
			void colBox;
		}
	}

	const connectors: RibbonConnector[] = [];
	for (let i = 0; i < ends.length - 1; i += 1) {
		const left = ends[i];
		const right = ends[i + 1];
		if (left === undefined || right === undefined || left.box === null || right.box === null) continue;
		const ax = boxOfColumn(left.column)?.right ?? left.box.right;
		const bx = boxOfColumn(right.column)?.left ?? right.box.left;
		const height = Math.max(left.box.bottom - left.box.top, right.box.bottom - right.box.top, rowHeight);
		connectors.push({ from: left.column, to: right.column, path: connectorPath(left.box, ax, right.box, bx), height: round(height), cx: round((ax + bx) / 2), cy: round((Math.max(left.box.top, right.box.top) + Math.min(left.box.bottom, right.box.bottom)) / 2) });
	}

	const first = ends[0];
	const second = ends[1];
	let caption: { x: number; y: number } | null = null;
	let box: Box | null = null;
	if (first?.box && second?.box) {
		const ax = boxOfColumn(first.column)?.right ?? first.box.right;
		const bx = boxOfColumn(second.column)?.left ?? second.box.left;
		caption = { x: round((ax + bx) / 2), y: round(Math.min(first.box.top, second.box.top) - 3) };
		box = { top: Math.min(first.box.top, second.box.top), bottom: Math.max(first.box.bottom, second.box.bottom), left: round(ax), right: round(bx) };
	}

	return { id: ribbon.id, tone: ribbon.tone ?? "duplicate", label: ribbon.label ?? null, bands, connectors, caption, box };
};

export { bandRect };
