import type { Box } from "../rows/row-types.js";
import type { RibbonConnector } from "./ribbon-types.js";
import type { RibbonColumnBox } from "./ribbon-measure.js";

/**
 * ── THE STUB ───────────────────────────────────────────────────────────────
 *
 * A one-ended ribbon (an added/removed member) is still part of the comparison:
 * it draws a STUB — a full row-height tongue from its row's corridor edge into
 * the corridor. Same strip shape as every other ribbon piece, never a sliver.
 */

const round = (v: number): number => Math.round(v * 10) / 10;

/** Which way the corridor lies from a lone end: towards the nearest other
 *  column, or away from the board edge when there is none. */
const stubSide = (colBox: Box, columns: readonly RibbonColumnBox[], own: string): boolean => {
	const centre = (colBox.left + colBox.right) / 2;
	const others = columns.filter((c): c is { id: string; box: Box } => c.id !== own && c.box !== null);
	if (others.length === 0) return colBox.left <= centre;
	const nearest = others.reduce((best, c) => (Math.abs(c.box.left - centre) < Math.abs(best.box.left - centre) ? c : best));
	return nearest.box.left > colBox.right;
};

/** The stub's closed filled strip between two boxes (flat, row-height). */
const stripPath = (a: Box, ax: number, b: Box, bx: number): string => {
	const mid = round((ax + bx) / 2);
	return [
		`M ${round(ax)} ${round(a.top)}`,
		`C ${mid} ${round(a.top)} ${mid} ${round(b.top)} ${round(bx)} ${round(b.top)}`,
		`L ${round(bx)} ${round(b.bottom)}`,
		`C ${mid} ${round(b.bottom)} ${mid} ${round(a.bottom)} ${round(ax)} ${round(a.bottom)}`,
		"Z",
	].join(" ");
};

export const stubOf = (end: { column: string; box: Box | null }, columns: readonly RibbonColumnBox[], rowHeight: number): RibbonConnector | null => {
	const colBox = columns.find((c) => c.id === end.column)?.box;
	if (end.box === null || colBox == null) return null;
	const toRight = stubSide(colBox, columns, end.column);
	const ax = toRight ? colBox.right : colBox.left;
	const bx = ax + (toRight ? 14 : -14);
	const stubBox: Box = { top: end.box.top, bottom: Math.min(end.box.bottom, end.box.top + rowHeight), left: Math.min(ax, bx), right: Math.max(ax, bx) };
	return { from: end.column, to: end.column, path: stripPath(stubBox, ax, stubBox, bx), height: round(stubBox.bottom - stubBox.top), cx: round((ax + bx) / 2), cy: round((stubBox.top + stubBox.bottom) / 2) };
};
