import { useLayoutEffect, type ReactElement, type ReactNode } from "react";
import styled from "styled-components";
import { useVirtualList } from "./hooks/use-virtual-list.js";

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

export interface VirtualListProps {
	readonly count: number;
	readonly rowHeight: number;
	readonly overscan: number;
	readonly fullMount: number;
	readonly maxHeight: string;
	readonly rubber: boolean;
	readonly cap: boolean;
	readonly bounded: boolean;
	readonly renderRow: (index: number) => ReactNode;
	readonly onWindow?: () => void;
}

export const VirtualList = ({ count, rowHeight, overscan, fullMount, maxHeight, rubber, cap, bounded, renderRow, onWindow }: VirtualListProps): ReactElement => {
	const { range, offsets, scroller, content, observeSlot } = useVirtualList(count, rowHeight, overscan, fullMount, onWindow);

	useLayoutEffect(() => {
		const element = content.current;
		if (element === null) return undefined;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const slot = (entry.target as HTMLElement).dataset.slot;
				if (slot !== undefined) observeSlot(Number(slot), entry.contentRect.height);
			}
		});
		for (const child of element.querySelectorAll("[data-slot]")) observer.observe(child);
		return () => observer.disconnect();
	}, [range.start, range.end, count]);

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
