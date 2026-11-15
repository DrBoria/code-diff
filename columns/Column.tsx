import { type ReactElement } from "react";
import styled from "styled-components";
import type { Column as ColumnModel } from "./column-types.js";
import type { Row as RowModel, RowId, RowRef, TextRangeHighlight } from "../rows/row-types.js";
import { Row } from "../rows/Row.js";
import { buildSpans } from "../rows/row-text.js";
import { useRowFold, type RowSlot } from "../rows/hooks/use-row-fold.js";
import { VirtualList } from "./VirtualList.js";
import { Actions } from "../components/Actions.js";
import { useBoard } from "../board/BoardProvider.js";
import { colorOf } from "../styles/theme-types.js";

/**
 * The column pane: a virtual list of rows + folded runs, with selection marks and
 * the shared Actions rendered above (VSCode) and inside (WebStorm) each row. It
 * reads config/theme/state from context and reports interactions through events.
 */

const Fold = styled.button<{ $rowHeight: number }>`
	position: relative;
	width: 100%;
	height: ${(p) => p.$rowHeight}px;
	line-height: ${(p) => p.$rowHeight}px;
	padding: 0;
	text-align: left;
	border: 0;
	border-top: 1px dashed ${(p) => p.theme.edge};
	border-bottom: 1px dashed ${(p) => p.theme.edge};
	background: ${(p) => p.theme.paper};
	color: ${(p) => p.theme.faint};
	font: italic 10.5px/${(p) => p.$rowHeight}px ${(p) => p.theme.mono};
	white-space: nowrap;
	cursor: pointer;
`;

const FoldText = styled.span`
	position: sticky;
	left: 0;
	display: inline-block;
	padding: 0 8px;
`;

export interface ColumnProps {
	readonly column: ColumnModel;
	readonly connected: ReadonlySet<RowId> | undefined;
	readonly highlights: ReadonlyMap<string, readonly TextRangeHighlight[]> | undefined;
	readonly onLayout: () => void;
}

export const Column = ({ column, connected, highlights, onLayout }: ColumnProps): ReactElement => {
	const { config, theme, state, emit, props } = useBoard();
	const rubber = props.fit === "rubber";
	const slots = useRowFold(column, connected, state.state.revealed, config.foldUnconnected);
	const actions = props.actions ?? [];
	const selected = new Set(state.state.selected.filter((r) => r.column === column.id).map((r) => String(r.row)));

	const renderSlot = (at: number): ReactElement | null => {
		const slot: RowSlot | undefined = slots[at];
		if (slot === undefined) return null;
		if (slot.kind === "fold") {
			return (
				<Fold type="button" $rowHeight={config.rowHeight} data-fold onClick={() => { state.setRevealed(true); emit("row:show", { rows: slot.ids.map((id) => ({ column: column.id, row: id })) }); }}>
					{slot.ids.map((id) => (
						<span key={String(id)} data-anchor={String(id)} style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
					))}
					<FoldText>{config.foldLabel(slot.count)}</FoldText>
				</Fold>
			);
		}
		return renderRow(slot.row, slot.index);
	};

	const renderRow = (row: RowModel, index: number): ReactElement => {
		const ref: RowRef = { column: column.id, row: row.id };
		const focus = highlights?.get(String(row.id)) ?? [];
		const marks = focus.length === 0 ? (row.marks ?? []) : [...(row.marks ?? []), ...focus];
		const tokens = row.text === undefined ? [] : (props.tokenize?.(row.text, column.id) ?? [{ text: row.text }]);
		const spans = row.spans ?? (row.text === undefined ? [{ text: String(row.id) }] : buildSpans(row.text, tokens, marks));
		const rowColor = row.tone === undefined ? undefined : colorOf(theme, row.tone);
		const explanationTone = row.explanation?.tone ?? row.tone;
		const explanationInk = explanationTone === undefined ? undefined : colorOf(theme, explanationTone).text;
		const params = { row: ref, selected: state.state.selected };
		const custom = props.renderRow?.({ row, column, index, mirrored: column.mirrored === true });

		return (
			<div key={String(row.id)} data-row-host onPointerEnter={() => emit("row:mouseEnter", { row: ref })} onPointerLeave={() => emit("row:mouseLeave", { row: null })}>
				<Row
					row={row}
					spans={spans}
					paint={rowColor?.paint}
					explanationInk={explanationInk}
					mirrored={column.mirrored === true}
					rubber={rubber}
					rowHeight={config.rowHeight}
					selected={selected.has(String(row.id))}
					aboveActions={<Actions actions={actions} entity="row" placement="above" params={params} emit={emit} />}
					insideActions={<Actions actions={actions} entity="row" placement={["inside-start", "inside-end"]} params={params} emit={emit} />}
					{...(custom === undefined ? {} : { renderCustom: custom })}
				/>
			</div>
		);
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
