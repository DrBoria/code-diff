import { useLayoutEffect, type RefObject } from "react";
import type { SyncGroup } from "../interface/types.js";

/**
 * ── SCROLL GROUPS ───────────────────────────────────────────────────────────
 *
 * A group is an EXPLICIT list of column ids that move as one — 1&4, or 1,3,5,
 * or every column. Any subset works because nothing here is named by an "axis
 * group": the ids are columns. `axis` only says which directions move together.
 */

/** The DOM pane a column scrolls in: the first child of its cell. */
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

/** Tie every pane in a group to whichever pane moved, per requested axis. */
export const useSyncedScroll = (root: RefObject<HTMLDivElement | null>, sync: readonly SyncGroup[]): void => {
	useLayoutEffect(() => {
		const element = root.current;
		if (!element) return undefined;

		const offs: (() => void)[] = [];

		for (const group of sync) {
			const panes = group.columns
				.map((id) => paneOf(element, id))
				.filter((pane): pane is HTMLElement => pane !== null);
			if (panes.length < 2) continue;

			for (const axis of axesOf(group)) {
				let busy = false;

				for (const pane of panes) {
					const handler = (): void => {
						if (busy) return;
						busy = true;
						for (const other of panes) {
							if (other !== pane) other[axis] = pane[axis];
						}
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
