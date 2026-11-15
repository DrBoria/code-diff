import { useMemo, useRef, useState, type ReactElement, type PointerEvent as ReactPointerEvent } from "react";
import type { BoardProps } from "./board-types.js";
import { BoardProvider, useBoard } from "./BoardProvider.js";
import { Frame, Cell, Corridor, templateOf } from "./board-layout.js";
import { Column } from "../columns/Column.js";
import { Surface } from "../surface/Surface.js";
import { useSurfaceMeasure } from "../surface/hooks/use-surface-measure.js";
import { useScrollRepaint, useSyncedScroll } from "../surface/hooks/use-surface-scroll.js";
import { useRibbonTone } from "../ribbon/hooks/use-ribbon-tone.js";
import { useRibbonChain } from "../ribbon/hooks/use-ribbon-chain.js";
import { useRibbonPaint } from "../ribbon/hooks/use-ribbon-paint.js";
import { useRibbonGeometry } from "../ribbon/hooks/use-ribbon-geometry.js";
import { RibbonConnector } from "../ribbon/RibbonConnector.js";
import { useRowGroups } from "../rows/hooks/use-row-groups.js";
import { connectedMapOf } from "../rows/hooks/use-row-fold.js";
import { Actions } from "../components/Actions.js";
import { Toolbar } from "../components/atoms.js";
import type { RowRef, TextRangeHighlight } from "../rows/row-types.js";
import type { Ribbon } from "../ribbon/ribbon-types.js";

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
	const [hoverRibbon, setHoverRibbon] = useState<string | null>(null);
	const [hoverRow, setHoverRow] = useState<RowRef | null>(null);

	const settleKey = `${columns.map((c) => c.id).join(",")}|${state.state.revealed}|${state.state.focusedRibbon}`;
	const { layout, measure, revision } = useSurfaceMeasure(root, config.bandGap, settleKey);
	const tone = useRibbonTone(ribbons, columns, theme);
	const chain = useRibbonChain(ribbons);
	const groups = useRowGroups(columns);

	// The PICKED chain (click-to-filter) narrows the fold. Hover NEVER narrows — it
	// only lights its chain at one uniform intensity while every other row stays
	// visible (rules 3 & 5: the whole board stays, the pointed chain glows).
	const focusedChain = state.state.focusedRibbon === null ? null : chain.chainOfRibbon(state.state.focusedRibbon);
	const rowChain = hoverRow === null ? null : chain.chainOfRow(hoverRow);
	const hotRibbon = hoverRibbon ?? (rowChain?.ribbon.id ?? null);

	// Group-lit rows from the hovered row's group.
	const hotRows = useMemo(() => {
		if (hoverRow === null) return new Set<string>();
		const group = groups.groupOf.get(`${hoverRow.column}::${String(hoverRow.row)}`);
		return group === undefined ? new Set<string>() : new Set(groups.byGroup.get(group) ?? []);
	}, [hoverRow, groups]);

	// Connected rows per column (for folding), narrowed to the focused chain.
	const connected = useMemo(() => {
		const ends = focusedChain === null ? ribbons.flatMap((r) => r.ends) : focusedChain.ribbon.ends;
		return connectedMapOf(columns, ends);
	}, [columns, ribbons, focusedChain]);

	// Text highlights of the focused chain, per column/row.
	const highlights = useMemo(() => {
		const active = rowChain ?? focusedChain;
		const map = new Map<string, Map<string, TextRangeHighlight[]>>();
		if (active === null) return map;
		for (const anchor of active.anchors) {
			const rows = map.get(anchor.column) ?? new Map<string, TextRangeHighlight[]>();
			const list = rows.get(anchor.line) ?? [];
			list.push({ from: anchor.from, to: anchor.to, strong: true, ...(anchor.ink === undefined ? {} : { ink: anchor.ink }) });
			rows.set(anchor.line, list);
			map.set(anchor.column, rows);
		}
		return map;
	}, [rowChain, focusedChain]);

	const paint = useRibbonPaint({ root, layer, columns, ribbons, tone, theme, rowHeight: config.rowHeight, bandGap: config.bandGap, hotRibbon, hotRows, revision });
	useScrollRepaint(root, paint);
	useSyncedScroll(root, props.sync ?? []);

	// Connector action icons (WebStorm merge): one holder per connector that has
	// ribbon actions, positioned in the corridor at the connector's centre.
	const geometry = useRibbonGeometry(ribbons, columns, layout, root.current, config.rowHeight);
	const connectorActions = (props.actions ?? []).filter((a) => a.entity === "ribbon" && a.placement === "connector");
	const corridorIndexOf = (from: string): number => columns.findIndex((c) => c.id === from);

	const ribbonAt = (target: Element): Ribbon | null => {
		const group = target.closest("[data-ribbon]");
		const id = group?.getAttribute("data-ribbon");
		return id === null || id === undefined ? null : (ribbons.find((r) => r.id === id) ?? null);
	};

	const onPointerOver = (event: ReactPointerEvent<HTMLDivElement>): void => {
		const target = event.target as HTMLElement;
		if (target.closest("svg") !== null) return;
		const cell = target.closest("[data-column]");
		const row = target.closest("[data-item]");
		if (cell instanceof HTMLElement && row instanceof HTMLElement && row.dataset.item !== undefined) {
			const ref = { column: cell.dataset.column ?? "", row: row.dataset.item };
			setHoverRow((current) => (current?.column === ref.column && String(current?.row) === String(ref.row) ? current : ref));
			setHoverRibbon(null);
		} else {
			setHoverRow(null);
		}
	};

	const onClick = (event: ReactPointerEvent<HTMLDivElement>): void => {
		const target = event.target as HTMLElement;
		if (target.closest("[data-action]") !== null || target.closest("[data-fold]") !== null) return;
		const cell = target.closest("[data-column]");
		const row = target.closest("[data-item]");
		if (cell instanceof HTMLElement && row instanceof HTMLElement && row.dataset.item !== undefined) {
			const ref = { column: cell.dataset.column ?? "", row: row.dataset.item };
			const prevented = emit("row:click", { row: ref }).defaultPrevented;
			if (prevented) return;
			const c = chain.chainOfRow(ref);
			if (c !== null) state.setFocused(state.state.focusedRibbon === c.ribbon.id ? null : c.ribbon.id);
		}
	};

	const toolbarActions = (props.actions ?? []).filter((a) => a.placement === "toolbar");

	return (
		<>
			{toolbarActions.length === 0 ? null : (
				<Toolbar>
					<Actions actions={props.actions ?? []} entity="row" placement="toolbar" params={{ selected: state.state.selected }} emit={emit} />
				</Toolbar>
			)}
			<Frame ref={root} $template={templateOf(props)} $height={config.boardHeight} onPointerOver={onPointerOver} onPointerMove={onPointerOver} onPointerLeave={() => { setHoverRow(null); setHoverRibbon(null); }} onClick={onClick}>
				{columns.map((column, index) => {
					const Render = props.renderers?.[column.id];
					const corridor = props.corridors?.[index];
					return (
						<div key={column.id} style={{ display: "contents" }}>
							<Cell data-column={column.id} $cap={column.cap === true} $bounded={config.boardHeight !== undefined}>
								{Render !== undefined ? <Render column={column} /> : <Column column={column} connected={connected.get(column.id)} highlights={highlights.get(column.id)} onLayout={measure} />}
							</Cell>
							{corridor === undefined ? null : (
								<Corridor data-corridor={index}>
									{connectorActions.length === 0
										? null
										: geometry.measured.flatMap(({ ribbon, shape }) =>
												shape.connectors
													.filter((connector) => corridorIndexOf(connector.from) === index)
													.map((connector) => (
														<RibbonConnector key={`${ribbon.id}-${connector.from}-${connector.to}`} connector={connector} originX={layout?.columns.get(column.id)?.left ?? 0}>
															<Actions actions={props.actions ?? []} entity="ribbon" placement="connector" params={{ ribbon, selected: state.state.selected }} emit={emit} />
														</RibbonConnector>
													)),
											)}
								</Corridor>
							)}
						</div>
					);
				})}
				<Surface
					ref={layer}
					onPointerOver={(e) => { const r = ribbonAt(e.target as Element); if (r !== null) { setHoverRibbon(r.id); setHoverRow(null); emit("ribbon:mouseEnter", { ribbon: r }); } }}
					onPointerLeave={() => { setHoverRibbon(null); emit("ribbon:mouseLeave", { ribbon: null }); }}
					onClick={(e) => { const r = ribbonAt(e.target as Element); if (r !== null) { e.stopPropagation(); const prevented = emit("ribbon:click", { ribbon: r }).defaultPrevented; if (!prevented) state.setFocused(state.state.focusedRibbon === r.id ? null : r.id); } }}
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
