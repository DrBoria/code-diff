import { type ReactElement } from "react";
import type { Column as ColumnModel } from "./column-types.js";
import type { Row as RowModel, RowRef, TextRangeHighlight } from "../rows/row-types.js";
import type { Ribbon, RibbonTextAnchor } from "../ribbon/ribbon-types.js";
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
	readonly hotRibbon: string | null;
	readonly selected: boolean;
}

/** The hovered ribbon's anchors on THIS row — a ribbon hover lights the words
 *  of its own chain only, never the standing marks of every other lane. */
const hotFocus = (ribbons: readonly Ribbon[], hot: string | null, column: string, id: string): TextRangeHighlight[] => {
	if (hot === null) return [];
	const ribbon = ribbons.find((r) => r.id === hot);
	const out: TextRangeHighlight[] = [];
	const pieces = (anchor: RibbonTextAnchor): (RibbonTextAnchor | undefined)[] => [anchor, anchor.duplicate];
	for (const anchor of ribbon?.anchors ?? []) {
		for (const piece of pieces(anchor)) {
			if (piece !== undefined && piece.column === column && String(piece.line) === id) out.push({ from: piece.from, to: piece.to, strong: true });
		}
	}
	return out;
};

// A rubber column ellipsizes long text (a syntax name wider than its strip);
// the full text stays one hover away instead of spilling into the corridor.
const rubberTitle = (rubber: boolean, plain: string): string | undefined => (rubber && plain.length > 0 ? plain : undefined);

export const ColumnRow = ({ column, row, index, rubber, focus, hotRibbon, selected }: ColumnRowProps): ReactElement => {
	const { config, theme, state, emit, props } = useBoard();
	const ref: RowRef = { column: column.id, row: row.id };
	const lit = focus.length > 0 ? focus : hotFocus(props.ribbons ?? [], hotRibbon, column.id, String(row.id));
	const view = rowViewOf({ row, column, focus: lit, theme, tokenize: props.tokenize });
	const params = { row: ref, selected: state.state.selected };
	const custom = props.renderRow?.({ row, column, index, mirrored: column.mirrored === true });
	// The merge "stage" cue: only a selectable board hands the row its toggle.
	const selectProps = config.selectable ? { onToggleSelect: () => state.toggleSelect(ref) } : {};
	const title = rubberTitle(rubber, row.text ?? view.spans.map((span) => span.text).join(""));

	return (
		<div key={String(row.id)} data-row-host title={title} onPointerEnter={() => emit("row:mouseEnter", { row: ref })} onPointerLeave={() => emit("row:mouseLeave", { row: null })}>
			<Row
				row={row}
				spans={view.spans}
				paint={view.paint}
				explanationInk={view.explanationInk}
				mirrored={column.mirrored === true}
				rubber={rubber}
				rowHeight={config.rowHeight}
				selected={selected}
				{...selectProps}
				aboveActions={<Actions actions={props.actions ?? []} entity="row" placement="above" params={params} emit={emit} />}
				insideActions={<Actions actions={props.actions ?? []} entity="row" placement={["inside-start", "inside-end"]} params={params} emit={emit} />}
				{...(custom === undefined ? {} : { renderCustom: custom })}
			/>
		</div>
	);
};
