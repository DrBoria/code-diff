import { type ReactElement } from "react";
import type { Column as ColumnModel } from "./column-types.js";
import type { RowId, TextRangeHighlight } from "../rows/row-types.js";
import { useRowFold, type RowSlot } from "../rows/hooks/use-row-fold.js";
import { VirtualList } from "./VirtualList.js";
import { ColumnRow } from "./ColumnRow.js";
import { ColumnFold } from "./ColumnFold.js";
import { useBoard } from "../board/BoardProvider.js";

/**
 * The column pane: a virtual list of rows + folded runs. Each row is rendered
 * by ColumnRow (spans, tint, actions); each folded run by ColumnFold. The pane
 * itself only decides WHICH slots exist — folding is the rows feature's job.
 */
export interface ColumnProps {
	readonly column: ColumnModel;
	readonly connected: ReadonlySet<RowId> | undefined;
	readonly highlights: ReadonlyMap<string, readonly TextRangeHighlight[]> | undefined;
	readonly onLayout: () => void;
}

export const Column = ({ column, connected, highlights, onLayout }: ColumnProps): ReactElement => {
	const { config, state, props } = useBoard();
	const rubber = props.fit === "rubber";
	const slots = useRowFold(column, connected, state.state.revealed, config.foldUnconnected);
	const selected = new Set(state.state.selected.filter((r) => r.column === column.id).map((r) => String(r.row)));

	const renderSlot = (at: number): ReactElement | null => {
		const slot: RowSlot | undefined = slots[at];
		if (slot === undefined) return null;
		if (slot.kind === "fold") return <ColumnFold slot={slot} columnId={column.id} />;
		return <ColumnRow column={column} row={slot.row} index={slot.index} rubber={rubber} focus={highlights?.get(String(slot.row.id)) ?? []} selected={selected.has(String(slot.row.id))} />;
	};

	return (
		<VirtualList
			count={slots.length}
			rowHeight={config.rowHeight}
			overscan={config.overscan}
			fullMount={config.fullMount}
			maxHeight={config.maxHeight}
			rubber={rubber}
			cap={column.cap === true}
			bounded={config.boardHeight !== undefined}
			renderRow={renderSlot}
			onWindow={onLayout}
		/>
	);
};
