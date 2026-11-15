import type { Box } from "../rows/row-types.js";
import { anchorKey, type AnchorLookup, type SurfaceLayout } from "./surface-types.js";

/**
 * The pure measurement of the backdrop: every `[data-anchor]` inside every
 * `[data-column]`, in CONTENT coordinates (scroll removed), so a scroll only
 * repaints — never re-measures. No React, no observers — the hook feeds this
 * the live element and commits the result.
 */

const union = (a: Box | undefined, b: Box): Box =>
	a === undefined ? b : { top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom), left: Math.min(a.left, b.left), right: Math.max(a.right, b.right) };

export const measureLayout = (root: HTMLElement, gap: number): SurfaceLayout => {
	const frame = root.getBoundingClientRect();
	const columns = new Map<string, Box>();
	const anchors = new Map<string, Box>();
	for (const column of root.querySelectorAll("[data-column]")) {
		const id = column.getAttribute("data-column") ?? "";
		const cell = column.getBoundingClientRect();
		columns.set(id, { top: cell.top - frame.top, bottom: cell.bottom - frame.top, left: cell.left - frame.left, right: cell.right - frame.left });
		const pane = column.firstElementChild instanceof HTMLElement ? column.firstElementChild : null;
		const scrolled = pane === null ? 0 : pane.scrollTop;
		for (const element of column.querySelectorAll("[data-anchor]")) {
			const anchor = element.getAttribute("data-anchor");
			if (!anchor) continue;
			const rect = element.getBoundingClientRect();
			const box: Box = { top: rect.top - cell.top + scrolled + gap, bottom: rect.bottom - cell.top + scrolled - gap, left: rect.left - frame.left, right: rect.right - frame.left };
			anchors.set(anchorKey(id, anchor), union(anchors.get(anchorKey(id, anchor)), box));
		}
	}
	return { columns, anchors };
};

export const readScrollTops = (root: HTMLElement): Map<string, number> => {
	const tops = new Map<string, number>();
	for (const column of root.querySelectorAll("[data-column]")) {
		const id = column.getAttribute("data-column") ?? "";
		const pane = column.firstElementChild instanceof HTMLElement ? column.firstElementChild : null;
		tops.set(id, pane === null ? 0 : pane.scrollTop);
	}
	return tops;
};

export const layoutLookup = (layout: SurfaceLayout | null, scrollTops: ReadonlyMap<string, number>): AnchorLookup => (column, id) => {
	const box = layout?.anchors.get(anchorKey(column, id));
	if (box === undefined) return null;
	const offset = scrollTops.get(column) ?? 0;
	return { top: box.top - offset, bottom: box.bottom - offset, left: box.left, right: box.right };
};

export const layoutColumn = (layout: SurfaceLayout | null, column: string): Box | null => layout?.columns.get(column) ?? null;

/** A stable fingerprint of a layout: identical geometry → identical key. */
export const layoutKey = (layout: SurfaceLayout): string =>
	[...layout.columns.entries()].map(([id, b]) => `${id}:${b.top.toFixed(1)},${b.bottom.toFixed(1)},${b.left.toFixed(1)},${b.right.toFixed(1)}`).join("|") +
	"#" +
	[...layout.anchors.entries()].map(([id, b]) => `${id}:${b.top.toFixed(1)},${b.bottom.toFixed(1)}`).join("|");
