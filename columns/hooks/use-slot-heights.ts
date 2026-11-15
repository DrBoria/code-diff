import { useRef } from "react";
import { prefixSums } from "../virtual-window.js";

/**
 * Per-slot real heights, prefix-summed for the virtual list. A different row
 * count (a reveal/fold changed the slots) invalidates the old per-index heights,
 * so stale heights never shrink the new window.
 */
export interface SlotHeights {
	/** Current prefix sums, length count+1. */
	readonly sums: () => readonly number[];
	/** Record a measured height; returns true when it changed anything. */
	readonly observe: (index: number, height: number) => boolean;
}

export const useSlotHeights = (count: number, rowHeight: number): SlotHeights => {
	const heights = useRef(new Map<number, number>());
	const offsets = useRef<number[]>([]);
	const lastCount = useRef(-1);

	if (lastCount.current !== count) {
		lastCount.current = count;
		heights.current.clear();
	}
	offsets.current = prefixSums(count, heights.current, rowHeight);

	return {
		sums: () => offsets.current,
		observe: (index, height) => {
			if (height <= 0 || heights.current.get(index) === height) return false;
			heights.current.set(index, height);
			offsets.current = prefixSums(count, heights.current, rowHeight);
			return true;
		},
	};
};
