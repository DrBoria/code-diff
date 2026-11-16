import type { ReactElement } from "react";
import type { BoardProps } from "./board-types.js";
import { Cell, Corridor } from "./board-layout.js";
import { Column } from "../columns/Column.js";
import { RibbonConnector } from "../ribbon/RibbonConnector.js";
import { Actions } from "../components/Actions.js";
import { useBoard } from "./BoardProvider.js";
import type { ConnectedMap } from "../columns/column-types.js";
import type { TextRangeHighlight } from "../rows/row-types.js";
import type { RibbonGeometry } from "../ribbon/hooks/use-ribbon-geometry.js";
import type { SurfaceLayout } from "../surface/surface-types.js";

/**
 * The columns row of the board: one cell per column, a corridor after some of
 * them, and the connector action icons (WebStorm merge) inside each corridor.
 */
export interface BoardColumnsProps {
	readonly props: BoardProps;
	readonly connected: ConnectedMap;
	readonly highlights: ReadonlyMap<string, ReadonlyMap<string, readonly TextRangeHighlight[]>>;
	readonly hotRibbon: string | null;
	readonly geometry: RibbonGeometry;
	readonly layout: SurfaceLayout | null;
	readonly onLayout: () => void;
}

export const BoardColumns = ({ props, connected, highlights, hotRibbon, geometry, layout, onLayout }: BoardColumnsProps): ReactElement => {
	const { config, state, emit } = useBoard();
	const actions = props.actions ?? [];
	const connectorActions = actions.filter((a) => a.entity === "ribbon" && a.placement === "connector");
	const corridorIndexOf = (from: string): number => props.columns.findIndex((c) => c.id === from);

	return (
		<>
			{props.columns.map((column, index) => {
				const Render = props.renderers?.[column.id];
				const corridor = props.corridors?.[index];
				return (
					<div key={column.id} style={{ display: "contents" }}>
						<Cell data-column={column.id} $cap={column.cap === true} $bounded={config.boardHeight !== undefined}>
							{Render !== undefined ? <Render column={column} /> : <Column column={column} connected={connected.get(column.id)} highlights={highlights.get(column.id)} hotRibbon={hotRibbon} onLayout={onLayout} />}
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
														<Actions actions={actions} entity="ribbon" placement="connector" params={{ ribbon, selected: state.state.selected }} emit={emit} />
													</RibbonConnector>
												)),
										)}
							</Corridor>
						)}
					</div>
				);
			})}
		</>
	);
};
