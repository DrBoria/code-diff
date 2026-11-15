import type { SyncGroup } from "../columns/column-types.js";

/**
 * The pure wiring of synced scroll: tie every pane of a group to whichever
 * pane moved, per requested axis. Returns the undo functions — the hook only
 * calls them on cleanup. A `busy` latch stops the echo (A scrolls B, B's scroll
 * event must not scroll A back).
 */

export const paneOf = (root: HTMLElement, id: string): HTMLElement | null => {
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

/** Wire one axis of one group; returns its undo. */
const wireAxis = (panes: readonly HTMLElement[], axis: "scrollTop" | "scrollLeft"): (() => void) => {
	let busy = false;
	const offs: (() => void)[] = [];
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
	return () => offs.forEach((off) => off());
};

/** Wire every group; returns the single undo of all of them. */
export const wireSync = (root: HTMLElement, sync: readonly SyncGroup[]): (() => void) => {
	const offs: (() => void)[] = [];
	for (const group of sync) {
		const panes = group.columns.map((id) => paneOf(root, id)).filter((pane): pane is HTMLElement => pane !== null);
		if (panes.length < 2) continue;
		for (const axis of axesOf(group)) offs.push(wireAxis(panes, axis));
	}
	return () => offs.forEach((off) => off());
};
