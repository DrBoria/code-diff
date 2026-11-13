import type { Box, Measured } from "../interface/types.js";

/**
 * ── MEASURING ───────────────────────────────────────────────────────────────
 *
 * Every number comes from a real box, and every box is expressed in the ROOT's
 * coordinates. The column of an anchor is not guessed by walking up from the
 * anchor: the columns are walked, and each anchor belongs to the one it is
 * inside. Deriving it from `closest()` gave every column the same coordinates,
 * so all bands landed on top of each other.
 */

/** Neighbouring bands never touch: the gap is what says "a different lane" — one hairline,
 *  not 2.5px on each side, which left a 13px stripe inside an 18px row and made a ribbon
 *  meet a band thinner than the row it joins. */
const GAP = 1;

export const boxOf = (element: Element, root: Element): Box => {
	const rect = element.getBoundingClientRect();
	const frame = root.getBoundingClientRect();

	return {
		top: rect.top - frame.top + GAP,
		bottom: rect.bottom - frame.top - GAP,
		left: rect.left - frame.left,
		right: rect.right - frame.left,
	};
};

const union = (a: Box | undefined, b: Box): Box =>
	a === undefined
		? b
		: {
				top: Math.min(a.top, b.top),
				bottom: Math.max(a.bottom, b.bottom),
				left: Math.min(a.left, b.left),
				right: Math.max(a.right, b.right),
			};

export const measureAnchors = (root: HTMLElement): Measured => {
	const anchors = new Map<string, Box>();
	const columns = new Map<string, Box>();

	for (const column of root.querySelectorAll("[data-column]")) {
		const id = column.getAttribute("data-column") ?? "";
		columns.set(id, boxOf(column, root));

		for (const element of column.querySelectorAll("[data-anchor]")) {
			const anchor = element.getAttribute("data-anchor");
			if (!anchor) continue;

			const key = `${id}\u0000${anchor}`;
			anchors.set(key, union(anchors.get(key), boxOf(element, root)));
		}
	}

	return { box: boxOf(root, root), anchors, columns };
};

export const anchorLookup = (measured: Measured | null) => (column: string, anchor: string): Box | null =>
	measured?.anchors.get(`${column}\u0000${anchor}`) ?? null;

/** The measured box of a column; geometry uses its corridor-facing edge. */
export const columnBoxOf = (measured: Measured | null, column: string): Box | null =>
	measured?.columns.get(column) ?? null;

/**
 * ── A LAYOUT, MEASURED ONCE ─────────────────────────────────────────────────
 *
 * `measureAnchors` answers "where is every anchor right NOW": the current scroll
 * offset is baked into every box, so its answer goes stale the moment a pane
 * scrolls. Re-measuring it per scroll frame is what made the board re-render on
 * every wheel tick.
 *
 * A LAYOUT is the same answer with the SCROLL TAKEN OUT. An anchor's box is
 * written in its column's CONTENT coordinates — where the row sits with
 * `scrollTop = 0`. Where it is on screen is then arithmetic: content position
 * minus the pane's scroll offset. A scroll repaints the shapes; it never
 * measures and never re-renders a column.
 */
export interface Layout {
	readonly columns: Map<string, Box>;
	/**
	 * Content coordinates: `top`/`bottom` ignore the pane's scroll.
	 * `left`/`right` are root pixels (a horizontal scroll is not a lane's business).
	 */
	readonly anchors: Map<string, Box>;
}

export const measureLayout = (root: HTMLElement, gap: number = GAP): Layout => {
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
			const key = `${id}\u0000${anchor}`;
			// Content coordinates: the row's own place inside the pane, not the place it
			// happens to be at with the pane scrolled where it is now.
			const box: Box = {
				top: rect.top - cell.top + scrolled + gap,
				bottom: rect.bottom - cell.top + scrolled - gap,
				left: rect.left - frame.left,
				right: rect.right - frame.left,
			};
			anchors.set(key, union(anchors.get(key), box));
		}
	}

	return { columns, anchors };
};

/** The scroll offset of every column's pane, read WITHOUT measuring anything. */
export const readScrollTops = (root: HTMLElement): Map<string, number> => {
	const tops = new Map<string, number>();
	for (const column of root.querySelectorAll("[data-column]")) {
		const id = column.getAttribute("data-column") ?? "";
		const pane = column.firstElementChild instanceof HTMLElement ? column.firstElementChild : null;
		tops.set(id, pane === null ? 0 : pane.scrollTop);
	}

	return tops;
};

/** A lookup over a LAYOUT at a given scroll offset: content position → screen box. */
export const layoutLookup =
	(layout: Layout | null, scrollTops: ReadonlyMap<string, number>, anchorOf?: (column: string, id: string) => string) =>
	(column: string, id: string): Box | null => {
		const anchor = anchorOf === undefined ? id : anchorOf(column, id);
		const box = layout?.anchors.get(`${column}\u0000${anchor}`);
		if (box === undefined) return null;
		const offset = scrollTops.get(column) ?? 0;

		return { top: box.top - offset, bottom: box.bottom - offset, left: box.left, right: box.right };
	};

/** The measured box of a column in a LAYOUT (x axis is scroll-independent). */
export const layoutColumn = (layout: Layout | null, column: string): Box | null => layout?.columns.get(column) ?? null;
