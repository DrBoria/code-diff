import { useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import styled from "styled-components";

/**
 * ── VIRTUAL ─────────────────────────────────────────────────────────────────
 *
 * A windowed list: only the rows the pane can SHOW are mounted — the viewport plus
 * ONE FULL VIEWPORT above it and one below (`overscan = 1`), so a fast scroll
 * never runs into unrendered space. Everything else is a spacer of the exact
 * height it would have had, so nothing jumps and no scroll position is invented.
 *
 * The rows are uniform: `rowHeight` is the height of ONE row, and the list is as
 * tall as `count × rowHeight`. That is what makes a scroll pure arithmetic — no
 * per-row measuring, no re-layout of the whole column.
 *
 * It owns the SCROLLER (the direct child of a column cell), because the board
 * reads a pane's `scrollTop` to place a lane: the scroller must not move.
 */

const Scroller = styled.div<{ $rubber: boolean; $cap: boolean; $maxHeight: string; $bounded: boolean }>`
	overflow-x: ${(p) => (p.$rubber ? "hidden" : "auto")};
	overflow-y: auto;
	/* A bounded board gives every pane a definite height to fill and scroll inside;
	   otherwise the pane is capped by the board's height (the column does not set it). */
	height: ${(p) => (p.$bounded ? "100%" : "auto")};
	max-height: ${(p) => (p.$cap || p.$bounded ? "100%" : p.$maxHeight)};
	/* The scrollbar is part of the artifact, drawn in the board's own palette — a
	   thin thumb on a transparent track, never the browser default and never hidden
	   (a hidden scrollbar made a tall pane look like it could not scroll at all). */
	scrollbar-width: thin;
	scrollbar-color: ${(p) => p.theme.edge} transparent;
	&::-webkit-scrollbar { width: 10px; height: 10px; }
	&::-webkit-scrollbar-track { background: transparent; }
	&::-webkit-scrollbar-thumb {
		background: ${(p) => p.theme.edge};
		border-radius: 6px;
		border: 2px solid ${(p) => p.theme.paper};
	}
	&::-webkit-scrollbar-thumb:hover { background: ${(p) => p.theme.faint}; }
	&::-webkit-scrollbar-corner { background: transparent; }
`;

/* The scroller's content: as wide as the widest row, but never narrower than the
   pane. Rows fill it, so every plate has the same room to stick to the edge. */
const Content = styled.div<{ $rubber: boolean }>`
	width: ${(p) => (p.$rubber ? "100%" : "max-content")};
	min-width: 100%;
`;

const Spacer = styled.div`
	width: 100%;
`;

/* One mounted row, observed for its real height. `data-slot` is the row's index in
   the list, so the observer knows which height to update. */
const Slot = styled.div`
	width: 100%;
`;

export interface VirtualProps {
	/** How many rows the list has. */
	readonly count: number;
	/** The height of one row, in pixels. */
	readonly rowHeight: number;
	/** How many viewports stay mounted above and below. 1 = 100% each way. */
	readonly overscan?: number;
	readonly rubber?: boolean;
	readonly cap?: boolean;
	/** One row; called only for the rows in the window. */
	readonly renderRow: (index: number) => ReactNode;
	/** The window moved: a different set of rows is mounted now. */
	readonly onWindow?: (() => void) | undefined;
	/** Lists up to this many rows are mounted whole (no windowing). Default 400. */
	readonly fullMount?: number;
	/** Max height of an uncapped pane (a CSS length). Default "70vh". */
	readonly maxHeight?: string;
	/** The board has a fixed height: this pane fills it and scrolls inside it. */
	readonly bounded?: boolean;
}

/**
 * A list this short is mounted WHOLE. Windowing exists for files of thousands of lines;
 * for a diff of two functions it only buys trouble — a row that is scrolled out cannot be
 * measured, so a lane whose end sits outside the window is not drawn at all, and the
 * picture claims the two sides are not connected. Mounting ~200 rows is cheap.
 */
const FULL_MOUNT = 400;

interface Range {
	readonly start: number;
	readonly end: number;
}

export const Virtual = ({ count, rowHeight, overscan = 1, rubber = false, cap = false, renderRow, onWindow, fullMount = FULL_MOUNT, maxHeight = "70vh", bounded = false }: VirtualProps): ReactElement => {
	const scroller = useRef<HTMLDivElement | null>(null);
	const content = useRef<HTMLDivElement | null>(null);
	// A first guess so the first paint is not empty; the layout effect corrects it
	// before the browser shows anything.
	const [range, setRange] = useState<Range>({ start: 0, end: Math.min(count, 60) });
	// The range the DOM is showing, kept OUTSIDE React state: the update below is where the
	// window is decided, and deciding it must not be an impure state updater.
	const applied = useRef<Range>({ start: -1, end: -1 });
	// The REAL height of each row, by index. Absent = the default `rowHeight`. A row
	// with an explanation under its code line is taller; the prefix-sum below uses the
	// measured value so spacers and ribbons never drift.
	const heights = useRef(new Map<number, number>());
	// Prefix sums of the heights: offsets[i] = the top of row i. For uniform rows this
	// is i * rowHeight, so a board without explanations pays nothing extra.
	const offsets = useRef<number[]>([]);
	const rebuild = (): void => {
		const sums: number[] = new Array(count + 1);
		sums[0] = 0;
		for (let i = 0; i < count; i += 1) sums[i + 1] = (sums[i] ?? 0) + (heights.current.get(i) ?? rowHeight);
		offsets.current = sums;
	};
	rebuild();

	// The window: which rows are mounted, from the scroll offset and the real offsets.
	// Kept in a ref so the scroll listener and the height observer always call the
	// latest closure (with the current count/rowHeight) without re-subscribing.
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
		// Binary search the first row whose bottom is past the window's top edge.
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
		// A DIFFERENT SET OF ROWS IS MOUNTED, so the geometry is measured again — and
		// only then. This runs OUTSIDE the updater: measuring a parent state from inside
		// one is an update during render, which is what turned opening a fold into an
		// endless render loop.
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

	// Measure the real height of every mounted row. A row that grows (an explanation
	// appears) or shrinks updates the prefix-sum and re-decides the window; the board
	// re-measures its anchors through onWindow, so ribbons follow the code line.
	useLayoutEffect(() => {
		const element = content.current;
		if (element === null) return undefined;
		const observer = new ResizeObserver((entries) => {
			let changed = false;
			for (const entry of entries) {
				const slot = (entry.target as HTMLElement).dataset.slot;
				if (slot === undefined) continue;
				const index = Number(slot);
				const height = entry.contentRect.height;
				if (height > 0 && heights.current.get(index) !== height) {
					heights.current.set(index, height);
					changed = true;
				}
			}
			if (!changed) return;
			rebuild();
			update.current();
			onWindow?.();
		});
		for (const child of element.querySelectorAll("[data-slot]")) observer.observe(child);

		return () => observer.disconnect();
	}, [range.start, range.end, count, rowHeight]);

	const rows: ReactNode[] = [];
	for (let index = range.start; index < range.end; index += 1) {
		rows.push(
			<Slot key={index} data-slot={index}>
				{renderRow(index)}
			</Slot>,
		);
	}
	const sums = offsets.current;
	const topSpace = sums[range.start] ?? 0;
	const bottomSpace = Math.max(0, (sums[count] ?? 0) - (sums[range.end] ?? 0));

	return (
		<Scroller ref={scroller} $rubber={rubber} $cap={cap} $maxHeight={maxHeight} $bounded={bounded}>
			<Content ref={content} $rubber={rubber}>
				<Spacer style={{ height: topSpace }} />
				{rows}
				<Spacer style={{ height: bottomSpace }} />
			</Content>
		</Scroller>
	);
};

export default Virtual;
