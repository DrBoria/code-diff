import { useRef, type ReactElement } from "react";
import type { BoardProps } from "./board-types.js";
import { BoardProvider, useBoard } from "./BoardProvider.js";
import { Frame, templateOf } from "./board-layout.js";
import { BoardColumns } from "./BoardColumns.js";
import { Surface } from "../surface/Surface.js";
import { useSurfaceMeasure } from "../surface/hooks/use-surface-measure.js";
import { useScrollRepaint, useSyncedScroll } from "../surface/hooks/use-surface-scroll.js";
import { useRibbonTone } from "../ribbon/hooks/use-ribbon-tone.js";
import { useRibbonChain } from "../ribbon/hooks/use-ribbon-chain.js";
import { useRibbonPaint } from "../ribbon/hooks/use-ribbon-paint.js";
import { useRibbonGeometry } from "../ribbon/hooks/use-ribbon-geometry.js";
import { useRowGroups } from "../rows/hooks/use-row-groups.js";
import { useBoardFocus } from "./hooks/use-board-focus.js";
import { useBoardPointer, ribbonAt } from "./hooks/use-board-pointer.js";
import { elementOf } from "../surface/dom.js";
import { Actions } from "../components/Actions.js";
import { Toolbar } from "../components/atoms.js";

/**
 * The composition root: columns over a backdrop, ribbons painted between them.
 * It wires the features together through context and events; it holds no row,
 * column or ribbon logic of its own.
 */
const BoardInner = (): ReactElement => {
	const { config, theme, state, emit, props } = useBoard();
	const root = useRef<HTMLDivElement | null>(null);
	const layer = useRef<SVGSVGElement | null>(null);
	const columns = props.columns;
	const ribbons = props.ribbons ?? [];

	const settleKey = `${columns.map((c) => c.id).join(",")}|${state.state.revealed}|${state.state.focusedRibbon}`;
	const { layout, measure, revision } = useSurfaceMeasure(root, config.bandGap, settleKey);
	const tone = useRibbonTone(ribbons, columns, theme);
	const chain = useRibbonChain(ribbons);
	const groups = useRowGroups(columns);
	const focus = useBoardFocus({ ribbons, columns, chain, groups, pickedRibbon: state.state.focusedRibbon });

	const paint = useRibbonPaint({ root, layer, columns, ribbons, tone, theme, rowHeight: config.rowHeight, bandGap: config.bandGap, hotRibbon: focus.hotRibbon, hotRows: focus.hotRows, revision });
	useScrollRepaint(root, paint);
	useSyncedScroll(root, props.sync ?? []);
	const geometry = useRibbonGeometry({ ribbons, columns, layout, root: root.current, rowHeight: config.rowHeight });

	const pointer = useBoardPointer({ emit, chain, focusedRibbon: state.state.focusedRibbon, setFocused: state.setFocused, setHoverRow: focus.setHoverRow, setHoverRibbon: focus.setHoverRibbon, setHoverChar: focus.setHoverChar });
	const toolbarActions = (props.actions ?? []).filter((a) => a.placement === "toolbar");

	return (
		<>
			{toolbarActions.length === 0 ? null : (
				<Toolbar>
					<Actions actions={props.actions ?? []} entity="row" placement="toolbar" params={{ selected: state.state.selected }} emit={emit} />
				</Toolbar>
			)}
			<Frame ref={root} $template={templateOf(props)} $height={config.boardHeight} onPointerOver={pointer.onPointerOver} onPointerMove={pointer.onPointerOver} onPointerLeave={() => { focus.setHoverRow(null); focus.setHoverRibbon(null); }} onClick={pointer.onClick}>
				<BoardColumns props={props} connected={focus.connected} highlights={focus.highlights} geometry={geometry} layout={layout} onLayout={measure} />
				<Surface
					ref={layer}
					onPointerOver={(e) => { const el = elementOf(e.target); const r = el === null ? null : ribbonAt(el, ribbons); if (r !== null) { focus.setHoverRibbon(r.id); focus.setHoverRow(null); emit("ribbon:mouseEnter", { ribbon: r }); } }}
					onPointerLeave={() => { focus.setHoverRibbon(null); emit("ribbon:mouseLeave", { ribbon: null }); }}
					onClick={(e) => { const el = elementOf(e.target); const r = el === null ? null : ribbonAt(el, ribbons); if (r !== null) { e.stopPropagation(); if (!emit("ribbon:click", { ribbon: r }).defaultPrevented) state.setFocused(state.state.focusedRibbon === r.id ? null : r.id); } }}
				/>
			</Frame>
		</>
	);
};

export const Board = (props: BoardProps): ReactElement => (
	<BoardProvider props={props}>
		<BoardInner />
	</BoardProvider>
);

export default Board;
