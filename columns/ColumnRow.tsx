import { type ReactElement } from "react";
import type { Column as ColumnModel } from "./column-types.js";
import type { Row as RowModel, RowRef, TextRangeHighlight } from "../rows/row-types.js";
import { Row } from "../rows/Row.js";
import { rowViewOf } from "./column-row-view.js";
import { Actions } from "../components/Actions.js";
import { useBoard } from "../board/BoardProvider.js";

/**
 * One row of a column: the pure view-model (column-row-view) decides its spans
 * and inks; this renders them with the shared row Actions above (VSCode) and
 * inside (WebStorm), and reports pointer events. Reads context, decides nothing.
 */
export interface ColumnRowProps {
	readonly column: ColumnModel;
	readonly row: RowModel;
	readonly index: number;
	readonly rubber: boolean;
	readonly focus: readonly TextRangeHighlight[];
	readonly selected: boolean;
}

export const ColumnRow = ({ column, row, index, rubber, focus, selected }: ColumnRowProps): ReactElement => {
	const { config, theme, state, emit, props } = useBoard();
	const ref: RowRef = { column: column.id, row: row.id };
	const view = rowViewOf({ row, column, focus, theme, tokenize: props.tokenize });
	const params = { row: ref, selected: state.state.selected };
	const custom = props.renderRow?.({ row, column, index, mirrored: column.mirrored === true });
	// A rubber column ellipsizes long text (a syntax name wider than its strip);
	// the full text stays one hover away instead of spilling into the corridor.
	const plain = row.text ?? view.spans.map((span) => span.text).join("");

	return (
		<div key={String(row.id)} data-row-host title={rubber && plain.length > 0 ? plain : undefined} onPointerEnter={() => emit("row:mouseEnter", { row: ref })} onPointerLeave={() => emit("row:mouseLeave", { row: null })}>
			<Row
				row={row}
				spans={view.spans}
				paint={view.paint}
				wash={view.wash}
				explanationInk={view.explanationInk}
				mirrored={column.mirrored === true}
				rubber={rubber}
				rowHeight={config.rowHeight}
				selected={selected}
				aboveActions={<Actions actions={props.actions ?? []} entity="row" placement="above" params={params} emit={emit} />}
				insideActions={<Actions actions={props.actions ?? []} entity="row" placement={["inside-start", "inside-end"]} params={params} emit={emit} />}
				{...(custom === undefined ? {} : { renderCustom: custom })}
			/>
		</div>
	);
};
