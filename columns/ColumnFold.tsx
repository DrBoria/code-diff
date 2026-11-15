import type { ReactElement } from "react";
import styled from "styled-components";
import type { RowId } from "../rows/row-types.js";
import type { RowSlot } from "../rows/hooks/use-row-fold.js";
import { useBoard } from "../board/BoardProvider.js";

type FoldSlot = Extract<RowSlot, { kind: "fold" }>;

/**
 * A folded run of unconnected rows: a dashed "… N lines" button that reveals
 * them. Zero-height anchors keep the fold measurable, so ribbons still attach
 * to folded rows exactly.
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

export interface ColumnFoldProps {
	readonly slot: FoldSlot;
	readonly columnId: string;
}

export const ColumnFold = ({ slot, columnId }: ColumnFoldProps): ReactElement => {
	const { config, state, emit } = useBoard();
	return (
		<Fold type="button" $rowHeight={config.rowHeight} data-fold onClick={() => { state.setRevealed(true); emit("row:show", { rows: slot.ids.map((id: RowId) => ({ column: columnId, row: id })) }); }}>
			{slot.ids.map((id) => (
				<span key={String(id)} data-anchor={String(id)} style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
			))}
			<FoldText>{config.foldLabel(slot.count)}</FoldText>
		</Fold>
	);
};
