import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Box } from "../../rows/row-types.js";
import { anchorKey, type AnchorLookup, type SurfaceLayout } from "../surface-types.js";

/**
 * Measures every `[data-anchor]` inside every `[data-column]`, in CONTENT
 * coordinates (scroll removed), so a scroll only repaints — never re-measures.
 * Re-measures on content/size change and after a fold/reveal settles.
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

const keyOf = (layout: SurfaceLayout): string =>
	[...layout.columns.entries()].map(([id, b]) => `${id}:${b.top.toFixed(1)},${b.bottom.toFixed(1)},${b.left.toFixed(1)},${b.right.toFixed(1)}`).join("|") +
	"#" +
	[...layout.anchors.entries()].map(([id, b]) => `${id}:${b.top.toFixed(1)},${b.bottom.toFixed(1)}`).join("|");

export interface SurfaceMeasure {
	readonly layout: SurfaceLayout | null;
	readonly measure: () => void;
	/** Bumped on every accepted measurement, so imperative paint re-runs. */
	readonly revision: number;
}

export const useSurfaceMeasure = (root: RefObject<HTMLDivElement | null>, gap: number, settleKey: string): SurfaceMeasure => {
	const [layout, setLayout] = useState<SurfaceLayout | null>(null);
	const [revision, setRevision] = useState(0);
	const lastKey = useRef("");
	const measure = useCallback((): void => {
		const element = root.current;
		if (element === null) return;
		const next = measureLayout(element, gap);
		const key = keyOf(next);
		if (key === lastKey.current) return;
		lastKey.current = key;
		setLayout(next);
		setRevision((r) => r + 1);
	}, [root, gap]);

	useLayoutEffect(() => {
		const element = root.current;
		if (!element) return undefined;
		lastKey.current = "";
		measure();
		const observer = new ResizeObserver(() => measure());
		observer.observe(element);
		for (const child of element.querySelectorAll("[data-column]")) observer.observe(child);
		// A reveal/fold mounts new rows in a child layout effect that runs AFTER this
		// one; re-measure once the frame settles so the anchors are on screen.
		let frame = requestAnimationFrame(() => measure());
		const timer = setTimeout(() => measure(), 80);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			clearTimeout(timer);
		};
	}, [root, measure, settleKey]);

	return { layout, measure, revision };
};
