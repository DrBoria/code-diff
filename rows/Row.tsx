import { type ReactElement, type ReactNode } from "react";
import styled from "styled-components";
import type { Row as RowModel, Counter, RowTextSpan } from "./row-types.js";
import { RowText } from "./RowText.js";

/**
 * The dumb row: number plate + text + counters + explanation + action slots.
 * It receives resolved spans and colours and reports pointer events upward; it
 * holds no folding, grouping or tone logic (those live in the row/column hooks).
 */

const Entry = styled.div<{ $selected?: boolean }>`
	width: 100%;
	position: relative;
	/* Rows carry NO background wash: the comparison is shown by ribbons and
	   word marks only. A tinted rectangle behind half the code is noise. */
	${(p) => (p.$selected === true ? `box-shadow: inset 3px 0 0 ${p.theme.text};` : "")}
`;

const Line = styled.div<{ $rubber: boolean; $rowHeight: number; $mirrored: boolean; $indent: number }>`
	display: flex;
	width: 100%;
	min-width: ${(p) => (p.$rubber ? "0" : "max-content")};
	overflow: ${(p) => (p.$rubber ? "hidden" : "visible")};
	white-space: pre;
	tab-size: 2;
	font-family: ${(p) => p.theme.mono};
	font-size: 12px;
	line-height: ${(p) => p.$rowHeight}px;
	padding-left: ${(p) => p.$indent * 16}px;
`;

const Plate = styled.span<{ $mirrored: boolean }>`
	position: sticky;
	left: ${(p) => (p.$mirrored ? "auto" : 0)};
	right: ${(p) => (p.$mirrored ? 0 : "auto")};
	flex: 0 0 44px;
	padding: 0 8px;
	text-align: right;
	order: ${(p) => (p.$mirrored ? 2 : 0)};
	background: ${(p) => p.theme.panel};
	color: ${(p) => p.theme.faint};
	z-index: 2;
	border-right: ${(p) => (p.$mirrored ? "0" : `1px solid ${p.theme.edge}`)};
	border-left: ${(p) => (p.$mirrored ? `1px solid ${p.theme.edge}` : "0")};
`;

const Text = styled.span<{ $rubber: boolean; $header?: boolean }>`
	display: inline-block;
	position: relative;
	flex: 1 1 auto;
	min-width: 0;
	padding: 0 8px;
	font-weight: ${(p) => (p.$header === true ? 600 : 400)};
	text-shadow: ${(p) => p.theme.shadow ?? "0 1px 2px rgba(0,0,0,0.9)"};
	${(p) => (p.$rubber ? "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" : "")}
`;

const CounterAnchor = styled.span`
	position: absolute;
	top: 0;
	width: 0;
	height: 0;
`;

const CounterBadge = styled.span`
	position: absolute;
	left: 0;
	top: 0;
	transform: translate(-50%, -50%);
	z-index: 3;
	padding: 0 3px;
	border: 1px solid ${(p) => p.theme.edge};
	border-radius: 3px;
	background: ${(p) => p.theme.panel};
	color: ${(p) => p.theme.text};
	font: 600 9.5px/11px ${(p) => p.theme.mono};
	white-space: nowrap;
`;

const Explanation = styled.div<{ $ink?: string }>`
	padding: 0 8px 2px 52px;
	font: italic 10.5px/14px ${(p) => p.theme.mono};
	color: ${(p) => p.$ink ?? p.theme.dim};
	white-space: pre-wrap;
	word-break: break-word;
`;

/* The selection checkbox: a small square on the left of the plate (the merge
   "stage" cue). Clicking it toggles the row in the controller's selection; it
   carries data-action so the board never also reads it as a row click. */
const SelectBox = styled.button<{ $on?: boolean }>`
	position: absolute;
	top: 2px;
	left: 2px;
	width: 13px;
	height: 13px;
	padding: 0;
	border: 1px solid ${(p) => (p.$on === true ? p.theme.text : p.theme.edge)};
	border-radius: 3px;
	background: ${(p) => (p.$on === true ? p.theme.text : "transparent")};
	color: ${(p) => p.theme.paper};
	font: 9px/1 ${(p) => p.theme.mono};
	cursor: pointer;
	z-index: 3;
`;

const Above = styled.div<{ $mirrored: boolean }>`
	position: absolute;
	top: 0;
	/* The action lives in the NUMBER GUTTER of its own row — it never covers
	   code, neither its own line nor the neighbour's. */
	left: ${(p) => (p.$mirrored ? "auto" : "2px")};
	right: ${(p) => (p.$mirrored ? "2px" : "auto")};
	z-index: 4;
	display: inline-flex;
	gap: 2px;
`;

const InsideEnd = styled.span`
	position: absolute;
	top: 0;
	right: 0;
	display: inline-flex;
	align-items: center;
	gap: 2px;
	height: 100%;
	padding: 0 2px;
	z-index: 3;
`;

export interface RowProps {
	readonly row: RowModel;
	readonly spans: readonly RowTextSpan[];
	readonly paint?: string;
	readonly explanationInk?: string;
	readonly mirrored: boolean;
	readonly rubber: boolean;
	readonly rowHeight: number;
	readonly selected?: boolean;
	/** When set, a selection checkbox is drawn and calls this on click. */
	readonly onToggleSelect?: () => void;
	readonly aboveActions?: ReactNode;
	readonly insideActions?: ReactNode;
	readonly renderCustom?: ReactNode;
}

/** The number plate + text + counters of one row (the custom render replaces it). */
const RowLine = ({ row, spans, paint, mirrored, rubber, rowHeight }: RowProps): ReactElement => (
	<Line $rubber={rubber} $rowHeight={rowHeight} $mirrored={mirrored} $indent={row.indent ?? 0} data-anchor={String(row.id)}>
		{row.plate === undefined ? null : <Plate $mirrored={mirrored}>{row.plate}</Plate>}
		<Text $rubber={rubber} $header={row.groupHeader === true}>
			<RowText spans={spans} {...(paint === undefined ? {} : { paint })} />
			{(row.counters ?? []).map((counter: Counter, at: number) => (
				<CounterAnchor key={at} style={{ left: `${counter.from}ch` }}>
					<CounterBadge title={counter.title}>{counter.text}</CounterBadge>
				</CounterAnchor>
			))}
		</Text>
	</Line>
);

export const Row = ({ row, spans, paint, explanationInk, mirrored, rubber, rowHeight, selected, onToggleSelect, aboveActions, insideActions, renderCustom }: RowProps): ReactElement => (
	<Entry data-item={String(row.id)} data-actions-host $selected={selected}>
		{onToggleSelect === undefined ? null : (
			<SelectBox
				type="button"
				$on={selected === true}
				data-action="select"
				title={selected === true ? "deselect row" : "select row"}
				onClick={(event) => {
					event.stopPropagation();
					onToggleSelect();
				}}
			>
				{selected === true ? "✓" : ""}
			</SelectBox>
		)}
		{aboveActions !== undefined ? <Above $mirrored={mirrored}>{aboveActions}</Above> : null}
		{renderCustom ?? <RowLine row={row} spans={spans} paint={paint} mirrored={mirrored} rubber={rubber} rowHeight={rowHeight} />}
		{row.explanation === undefined ? null : <Explanation {...(explanationInk === undefined ? {} : { $ink: explanationInk })}>{row.explanation.text}</Explanation>}
		{insideActions !== undefined ? <InsideEnd>{insideActions}</InsideEnd> : null}
	</Entry>
);
