import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Windowed list logic: only the rows the pane can show are mounted (viewport +
 * overscan). Rows may have variable height (an explanation under the code line),
 * so real heights are measured and prefix-summed; spacers use the sums so nothing
 * jumps. The window decision lives here, the dumb scroller lives in VirtualList.
 */
export interface VirtualRange {
	readonly start: number;
	readonly end: number;
}

export interface VirtualApi {
	readonly range: VirtualRange;
	readonly offsets: readonly number[];
	readonly scroller: RefObject<HTMLDivElement | null>;
	readonly content: RefObject<HTMLDivElement | null>;
	readonly observeSlot: (index: number, height: number) => void;
}

export const useVirtualList = (count: number, rowHeight: number, overscan: number, fullMount: number, onWindow?: () => void): VirtualApi => {
	const scroller = useRef<HTMLDivElement | null>(null);
	const content = useRef<HTMLDivElement | null>(null);
	const [range, setRange] = useState<VirtualRange>({ start: 0, end: Math.min(count, 60) });
	const applied = useRef<VirtualRange>({ start: -1, end: -1 });
	const heights = useRef(new Map<number, number>());
	const offsets = useRef<number[]>([]);

	// A different row count (a reveal/fold changed the slots) invalidates the old
	// per-index heights; reset so stale heights never shrink the new window.
	const lastCount = useRef(count);
	if (lastCount.current !== count) {
		lastCount.current = count;
		heights.current.clear();
		applied.current = { start: -1, end: -1 };
	}

	const rebuild = (): void => {
		const sums: number[] = new Array(count + 1);
		sums[0] = 0;
		for (let i = 0; i < count; i += 1) sums[i + 1] = (sums[i] ?? 0) + (heights.current.get(i) ?? rowHeight);
		offsets.current = sums;
	};
	rebuild();

	const update = useRef<() => void>(() => {});
	update.current = (): void => {
		const element = scroller.current;
		if (element === null) return;
		if (count <= fullMount) {
			if (applied.current.start !== 0 || applied.current.end !== count) {
				applied.current = { start: 0, end: count };
				setRange({ start: 0, end: count });
				onWindow?.();
			}
			return;
		}
		const height = element.clientHeight;
		const headroom = height * overscan;
		const sums = offsets.current;
		const top = element.scrollTop;
		let lo = 0;
		let hi = count;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if ((sums[mid + 1] ?? 0) <= top - headroom) lo = mid + 1;
			else hi = mid;
		}
		const first = Math.max(0, lo);
		let last = first;
		while (last < count && (sums[last] ?? 0) < top + height + headroom) last += 1;
		const end = Math.max(last, Math.min(count, first + 1));
		if (applied.current.start === first && applied.current.end === end) return;
		applied.current = { start: first, end };
		setRange({ start: first, end });
		onWindow?.();
	};

	useLayoutEffect(() => {
		const element = scroller.current;
		if (element === null) return undefined;
		update.current();
		const onScroll = (): void => update.current();
		const observer = new ResizeObserver(onScroll);
		observer.observe(element);
		element.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			observer.disconnect();
			element.removeEventListener("scroll", onScroll);
		};
	}, [count, rowHeight, overscan, fullMount]);

	const observeSlot = (index: number, height: number): void => {
		if (height > 0 && heights.current.get(index) !== height) {
			heights.current.set(index, height);
			rebuild();
			// In full-mount every row is already mounted: a height change only shifts
			// spacers, it must NOT re-decide the window (that oscillated the reveal).
			// Just re-measure the ribbon anchors so they follow the code line.
			if (count <= fullMount) {
				onWindow?.();
				return;
			}
			update.current();
		}
	};

	return { range, offsets: offsets.current, scroller, content, observeSlot };
};
