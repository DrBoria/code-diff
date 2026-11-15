import { useCallback, type ReactElement, type ReactNode } from "react";
import styled from "styled-components";
import { useVirtualList, type VirtualArgs } from "./hooks/use-virtual-list.js";
import { useDomObserver } from "../surface/hooks/use-dom-observer.js";
import { readSlotHeights } from "./slot-heights.js";

/**
 * The dumb windowed scroller. It owns the scroll element (the board reads a
 * pane's scrollTop to place ribbons), renders only the window's rows, and spaces
 * the rest with exact-height spacers. Row heights are observed for real.
 */

const Scroller = styled.div<{ $rubber: boolean; $cap: boolean; $maxHeight: string; $bounded: boolean }>`
	overflow-x: ${(p) => (p.$rubber ? "hidden" : "auto")};
	overflow-y: auto;
	height: ${(p) => (p.$bounded ? "100%" : "auto")};
	max-height: ${(p) => (p.$cap || p.$bounded ? "100%" : p.$maxHeight)};
	scrollbar-width: thin;
	scrollbar-color: ${(p) => p.theme.edge} transparent;
	&::-webkit-scrollbar { width: 10px; height: 10px; }
	&::-webkit-scrollbar-track { background: transparent; }
	&::-webkit-scrollbar-thumb { background: ${(p) => p.theme.edge}; border-radius: 6px; border: 2px solid ${(p) => p.theme.paper}; }
	&::-webkit-scrollbar-thumb:hover { background: ${(p) => p.theme.faint}; }
	&::-webkit-scrollbar-corner { background: transparent; }
`;

const Content = styled.div<{ $rubber: boolean }>`
	width: ${(p) => (p.$rubber ? "100%" : "max-content")};
	min-width: 100%;
`;

const Slot = styled.div`
	width: 100%;
`;

/** The scroller takes the windowing contract plus its own chrome knobs. */
export interface VirtualListProps extends VirtualArgs {
	readonly maxHeight: string;
	readonly rubber: boolean;
	readonly cap: boolean;
	readonly bounded: boolean;
	readonly renderRow: (index: number) => ReactNode;
}

export const VirtualList = ({ count, rowHeight, overscan, fullMount, maxHeight, rubber, cap, bounded, renderRow, onWindow }: VirtualListProps): ReactElement => {
	const { range, offsets, scroller, content, observeSlot } = useVirtualList({ count, rowHeight, overscan, fullMount, onWindow });

	// Every mounted slot is observed for its REAL height; the window re-decides
	// itself when the mounted set changes (range/count in the callback identity).
	const onSizes = useCallback((): void => {
		if (content.current !== null) readSlotHeights(content.current, observeSlot);
	}, [content, observeSlot, range.start, range.end, count]);
	useDomObserver({ root: content, selector: "[data-slot]", onChange: onSizes });

	const rows: ReactNode[] = [];
	for (let index = range.start; index < range.end; index += 1) {
		rows.push(
			<Slot key={index} data-slot={index}>
				{renderRow(index)}
			</Slot>,
		);
	}
	const topSpace = offsets[range.start] ?? 0;
	const bottomSpace = Math.max(0, (offsets[count] ?? 0) - (offsets[range.end] ?? 0));

	return (
		<Scroller ref={scroller} $rubber={rubber} $cap={cap} $maxHeight={maxHeight} $bounded={bounded}>
			<Content ref={content} $rubber={rubber}>
				<div style={{ height: topSpace }} />
				{rows}
				<div style={{ height: bottomSpace }} />
			</Content>
		</Scroller>
	);
};
