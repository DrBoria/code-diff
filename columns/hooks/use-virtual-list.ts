import { useCallback, useRef, useState, type RefObject } from "react";
import type { VirtualRange } from "../virtual-window.js";
import { decideWindow } from "../virtual-decide.js";
import { useSlotHeights } from "./use-slot-heights.js";
import { useDomObserver } from "../../surface/hooks/use-dom-observer.js";
import { commitIfChanged } from "../../surface/commit-gate.js";

/**
 * Windowed list logic: only the rows the pane can show are mounted (viewport +
 * overscan). Real slot heights are prefix-summed (useSlotHeights); the window
 * decision is pure (virtual-decide); size/scroll wiring is the surface's shared
 * DOM-observer hook. The dumb scroller lives in VirtualList.
 */
export type { VirtualRange };

export interface VirtualApi {
	readonly range: VirtualRange;
	readonly offsets: readonly number[];
	readonly scroller: RefObject<HTMLDivElement | null>;
	readonly content: RefObject<HTMLDivElement | null>;
	readonly observeSlot: (index: number, height: number) => void;
}

export interface VirtualArgs {
	readonly count: number;
	readonly rowHeight: number;
	readonly overscan: number;
	readonly fullMount: number;
	readonly onWindow?: () => void;
}

/** Commit a window only when it actually changed; tell the board to re-measure. */
const useWindowCommit = (applied: { current: VirtualRange }, setRange: (r: VirtualRange) => void, onWindow?: () => void) =>
	(next: VirtualRange): void => {
		commitIfChanged({
			next,
			last: applied,
			same: (a, b) => a.start === b.start && a.end === b.end,
			commit: (value) => {
				setRange(value);
				onWindow?.();
			},
		});
	};

export const useVirtualList = ({ count, rowHeight, overscan, fullMount, onWindow }: VirtualArgs): VirtualApi => {
	const scroller = useRef<HTMLDivElement | null>(null);
	const content = useRef<HTMLDivElement | null>(null);
	const [range, setRange] = useState<VirtualRange>({ start: 0, end: Math.min(count, 60) });
	const applied = useRef<VirtualRange>({ start: -1, end: -1 });
	const heights = useSlotHeights(count, rowHeight);
	const apply = useWindowCommit(applied, setRange, onWindow);

	const update = useCallback((): void => {
		const element = scroller.current;
		if (element !== null) apply(decideWindow({ element, count, fullMount, overscan, sums: heights.sums() }));
	}, [count, fullMount, overscan, apply, heights]);

	// A different row count invalidates the applied window: re-decide it.
	const lastCount = useRef(-1);
	if (lastCount.current !== count) {
		lastCount.current = count;
		applied.current = { start: -1, end: -1 };
	}
	useDomObserver({ root: scroller, onChange: update, scroll: true });

	const observeSlot = (index: number, height: number): void => {
		if (!heights.observe(index, height)) return;
		// In full-mount every row is mounted: a height change only shifts spacers,
		// it must NOT re-decide the window (that oscillated the reveal). Just
		// re-measure the ribbon anchors so they follow the code line.
		if (count <= fullMount) onWindow?.();
		else update();
	};

	return { range, offsets: heights.sums(), scroller, content, observeSlot };
};
