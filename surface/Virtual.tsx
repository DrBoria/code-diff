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

const Scroller = styled.div<{ $rubber: boolean; $cap: boolean }>`
	overflow-x: ${(p) => (p.$rubber ? "hidden" : "auto")};
	overflow-y: auto;
	/* Capped: the board's height is the ceiling (the column does not set it). */
	max-height: ${(p) => (p.$cap ? "100%" : "74vh")};
	scrollbar-width: none;
	&::-webkit-scrollbar { width: 0; height: 0; display: none; }
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

export const Virtual = ({ count, rowHeight, overscan = 1, rubber = false, cap = false, renderRow, onWindow }: VirtualProps): ReactElement => {
	const scroller = useRef<HTMLDivElement | null>(null);
	// A first guess so the first paint is not empty; the layout effect corrects it
	// before the browser shows anything.
	const [range, setRange] = useState<Range>({ start: 0, end: Math.min(count, 60) });	// The range the DOM is showing, kept OUTSIDE React state: the update below is where the
	// window is decided, and deciding it must not be an impure state updater.
	const applied = useRef<Range>({ start: -1, end: -1 });

	useLayoutEffect(() => {
		const element = scroller.current;
		if (element === null) return undefined;
		if (count <= FULL_MOUNT) {
			setRange((current) => (current.start === 0 && current.end === count ? current : { start: 0, end: count }));

			return undefined;
		}

		const update = (): void => {
			const height = element.clientHeight;
			const headroom = height * overscan;
			const first = Math.max(0, Math.floor((element.scrollTop - headroom) / rowHeight));
			const last = Math.min(count, Math.ceil((element.scrollTop + height + headroom) / rowHeight));
			// At least the viewport, so a pane that is not laid out yet still shows rows.
			const end = Math.max(last, Math.min(count, first + Math.ceil(height / rowHeight) + 1));
			if (applied.current.start === first && applied.current.end === end) return;
			applied.current = { start: first, end };
			setRange({ start: first, end });
			// A DIFFERENT SET OF ROWS IS MOUNTED, so the geometry is measured again — and
			// only then. This runs OUTSIDE the updater: measuring a parent state from inside
			// one is an update during render, which is what turned opening a fold into an
			// endless render loop.
			onWindow?.();
		};

		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		element.addEventListener("scroll", update, { passive: true });

		return () => {
			observer.disconnect();
			element.removeEventListener("scroll", update);
		};
	}, [count, rowHeight, overscan, onWindow]);

	const rows: ReactNode[] = [];
	for (let index = range.start; index < range.end; index += 1) rows.push(renderRow(index));

	return (
		<Scroller ref={scroller} $rubber={rubber} $cap={cap}>
			<Content $rubber={rubber}>
				<Spacer style={{ height: range.start * rowHeight }} />
				{rows}
				<Spacer style={{ height: Math.max(0, (count - range.end) * rowHeight) }} />
			</Content>
		</Scroller>
	);
};

export default Virtual;
