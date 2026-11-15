import { useLayoutEffect, type RefObject } from "react";
import type { SyncGroup } from "../../columns/column-types.js";

/**
 * Scroll behaviour of the backdrop: repaint on scroll (no re-measure), and tie
 * explicit groups of columns together per requested axis.
 */

const paneOf = (root: HTMLElement, id: string): HTMLElement | null => {
	const cell = root.querySelector(`[data-column="${CSS.escape(id)}"]`);
	const pane = cell?.firstElementChild;
	return pane instanceof HTMLElement ? pane : null;
};

const axesOf = (group: SyncGroup): ("scrollTop" | "scrollLeft")[] => {
	const axis = group.axis ?? "xy";
	const axes: ("scrollTop" | "scrollLeft")[] = [];
	if (axis.includes("y")) axes.push("scrollTop");
	if (axis.includes("x")) axes.push("scrollLeft");
	return axes;
};

/** Repaint callback on any pane scroll, coalesced to one per frame. */
export const useScrollRepaint = (root: RefObject<HTMLDivElement | null>, repaint: () => void): void => {
	useLayoutEffect(() => {
		const element = root.current;
		if (!element) return undefined;
		let frame = 0;
		const onScroll = (): void => {
			if (frame !== 0) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				repaint();
			});
		};
		element.addEventListener("scroll", onScroll, { passive: true, capture: true });
		return () => {
			element.removeEventListener("scroll", onScroll, { capture: true });
			if (frame !== 0) cancelAnimationFrame(frame);
		};
	}, [root, repaint]);
};

/** Tie every pane in a group to whichever pane moved, per requested axis. */
export const useSyncedScroll = (root: RefObject<HTMLDivElement | null>, sync: readonly SyncGroup[]): void => {
	useLayoutEffect(() => {
		const element = root.current;
		if (!element) return undefined;
		const offs: (() => void)[] = [];
		for (const group of sync) {
			const panes = group.columns.map((id) => paneOf(element, id)).filter((pane): pane is HTMLElement => pane !== null);
			if (panes.length < 2) continue;
			for (const axis of axesOf(group)) {
				let busy = false;
				for (const pane of panes) {
					const handler = (): void => {
						if (busy) return;
						busy = true;
						for (const other of panes) if (other !== pane) other[axis] = pane[axis];
						requestAnimationFrame(() => {
							busy = false;
						});
					};
					pane.addEventListener("scroll", handler);
					offs.push(() => pane.removeEventListener("scroll", handler));
				}
			}
		}
		return () => offs.forEach((off) => off());
	}, [root, sync]);
};
