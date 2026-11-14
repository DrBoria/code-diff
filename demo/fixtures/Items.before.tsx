import { type ReactElement, type ReactNode } from "react";
import styled from "styled-components";
import type { Item, Placed, RendererProps } from "../interface/types.js";
import { anchorOf } from "./column.js";
import { buildSegments } from "./segments.js";
import { edgesOf } from "../connections/edges.js";
import { Virtual } from "../surface/Virtual.js";

/**
 * ── ITEM AND GRAPH RENDERERS ────────────────────────────────────────────────
 *
 * The two renderers the package ships. Both take every colour and every font from
 * `theme`, and every string from the column: nothing here is a package constant.
 *
 * The list is VIRTUAL (`surface/Virtual.tsx`): the height of a row is fixed, so a
 * column of 500 lines mounts the visible ones plus one viewport above and below,
 * and a scroll never lays out — or measures — the rest.
 */

/** One row's height: every row in this list is one line of the board. */
const ROW_HEIGHT = 18;

const Entry = styled.div`
	/* Every row is as wide as the WIDEST row, not just its own text: a sticky
	   plate can only slide inside its own row, so a short row must still reach the
	   right edge or its number detaches and scrolls away with the text. */
	width: 100%;
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
	/* The plate stays ON TOP of the code: a scrolled line slides under the numbers,
	   never over them — without its own layer the text painted across the digits. */
	z-index: 2;
	border-right: ${(p) => (p.$mirrored ? "0" : `1px solid ${p.theme.edge}`)};
	border-left: ${(p) => (p.$mirrored ? `1px solid ${p.theme.edge}` : "0")};
`;

const Row = styled.div<{ $rubber: boolean; $rowHeight: number }>`
	display: flex;
	width: 100%;
	min-width: ${(p) => (p.$rubber ? "0" : "max-content")};
	overflow: ${(p) => (p.$rubber ? "hidden" : "visible")};
	white-space: pre;
	/* Indentation is part of the text. Two columns per tab, so a character offset in a
	   row is a column a note can be anchored to — one ch is one character. */
	tab-size: 2;
	font-family: ${(p) => p.theme.mono};
	font-size: 12px;
	/* The row's height is the SAME number the virtual list spaces by, so a configured
	   rowHeight never drifts the spacers away from the real rows. */
	line-height: ${(p) => p.$rowHeight}px;
`;

const Line = styled.span<{ $mirrored: boolean; $rubber: boolean }>`
	display: flex;
	flex: 1 1 auto;
	min-width: 0;
	padding: 0 8px;
	justify-content: flex-start;
	overflow: ${(p) => (p.$rubber ? "hidden" : "visible")};
`;

const Text = styled.span<{ $rubber: boolean }>`
	display: inline-block;
	position: relative;
	/* A backdrop under the glyphs so they read on a wash. The theme owns it: the
	   default is dark (for dark code surfaces), a light theme supplies its own. */
	text-shadow: ${(p) => p.theme.shadow ?? "0 1px 2px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.85), 0 -1px 2px rgba(0, 0, 0, 0.6)"};
	${(p) => (p.$rubber ? "flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" : "")}
`;

/* A number pinned ABOVE its row, at the character it counts. The ANCHOR is a
   zero-size block that inherits the CODE font, so `left: Nch` measures N columns
   of code and not N columns of the note's smaller font. The note itself is
   centred on that anchor and straddles the row's top edge. */
const NoteAnchor = styled.span`
	position: absolute;
	top: 0;
	width: 0;
	height: 0;
`;

const Note = styled.span`
	position: absolute;
	left: 0;
	top: 0;
	/* Half over the row, half on it: the number is centred on the TOP EDGE of the row it
	   counts, so it belongs to that row and not to the one above. */
	transform: translate(-50%, -50%);
	z-index: 3;
	padding: 0 3px;
	border: 1px solid ${(p) => p.theme.edge};
	border-radius: 3px;
	background: ${(p) => p.theme.panel};
	color: ${(p) => p.theme.text};
	font: 600 9.5px/11px ${(p) => p.theme.mono};
	white-space: nowrap;
	pointer-events: auto;
`;

// A painted range is a highlighter, not a curtain: the text keeps its shape but
// takes a contrasting ink, so a marked keyword stays readable on the mark.
// A STRONG range is the occurrence a lane under the pointer stands for: the same
// mark, held brighter, so the reader sees exactly which piece is being talked about.
const Paint = styled.span<{ $strong?: boolean }>`
	background: ${(p) => p.theme.paint ?? "transparent"};
	border-radius: 2px;
	text-decoration: underline;
	box-decoration-break: clone;
	/* The mark is a WASH, not a repaint: the token colour underneath stays, which is what
	   makes a keyword, a string and an operator still read as themselves on a band. */
	text-shadow: ${(p) => p.theme.shadow ?? "0 1px 2px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.85)"};
	${(p) => (p.$strong === true ? "outline: 1px solid currentColor;" : "")}
`;

const Fold = styled.button<{ $rowHeight: number }>`
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

/* The label stays on the pane's left edge: a fold is as wide as the widest row,
   so without this its text scrolls out of view and reads "lick to show". */
const FoldText = styled.span`
	position: sticky;
	left: 0;
	display: inline-block;
	padding: 0 8px;
`;

const piece = (segment: { text: string; paint?: boolean; strong?: boolean; ink?: string }, at: number): ReactElement => {
	const ink = segment.ink === undefined ? undefined : { color: segment.ink };

	// A painted piece KEEPS its token colour and takes the mark as a wash behind it: the
	// mark says "this range is the one the lane is about", the colour says what the code
	// IS. Dropping the ink turned every marked range into the same white slab.
	return segment.paint ? (
		<Paint key={at} $strong={segment.strong === true} style={ink}>{segment.text}</Paint>
	) : (
		<span key={at} style={ink}>
			{segment.text}
		</span>
	);
};

const content = <Data,>(it: Item<Data>, column: RendererProps<Data>["column"], index: number, render: RendererProps<Data>["render"], onAction: RendererProps<Data>["onAction"], rubber: boolean, tokenize: RendererProps<Data>["tokenize"], highlights: RendererProps<Data>["highlight"], rowHeight: number): ReactElement => {
	if (it.collapsed) {
		return (
			<Fold type="button" $rowHeight={rowHeight} data-anchor={anchorOf(it)} onClick={() => onAction?.(it)}>
				<FoldText>{it.collapsed.text}</FoldText>
			</Fold>
		);
	}

	if (render) return <>{render({ item: it, column, index, mirrored: column.mirrored === true })}</>;

	// When the item carries plain `text`, the package builds its segments itself:
	// tokenize (owner's palette) + marks (ranges to paint). An explicit `segments`
	// list still wins, so a caller can take full control.
	const focus = highlights?.get(String(it.id)) ?? [];
	const marks = focus.length === 0 ? (it.marks ?? []) : [...(it.marks ?? []), ...focus];
	const segments = it.segments ?? (it.text === undefined ? undefined : buildSegments(it.text, tokenize === undefined ? [] : tokenize(it.text, column.id), marks));

	return (
		<Row $rubber={rubber} $rowHeight={rowHeight} data-anchor={anchorOf(it)}>
			{it.plate === undefined ? null : <Plate $mirrored={column.mirrored === true}>{it.plate}</Plate>}
			<Line $mirrored={column.mirrored === true} $rubber={rubber}>
				{/* The ANCHOR is the ROW, not the text inside it: a band measured on the line
				    box was 13px tall inside an 18px row, so the wash was a stripe with gaps and
				    a ribbon met a band thinner than the row it joins. */}
				<Text $rubber={rubber}>
					{(segments ?? []).map(piece)}
					{segments === undefined ? <span>{String(it.id)}</span> : null}
					{(it.notes ?? []).map((note, at) => (
						<NoteAnchor key={`note-${at}`} style={{ left: `${note.from}ch` }}>
							<Note title={note.title}>{note.text}</Note>
						</NoteAnchor>
					))}
				</Text>
			</Line>
		</Row>
	);
};

/**
 * The default list. It HIDES every item that takes no part in a connection and
 * folds each hidden run into one button — "there was something here, open it".
 * Visibility is the board's decision (it passed `connected`), so the data source
 * never has to say which lines are folds.
 */
export const Items = <Data,>({ column, render, onAction, connected, expanded = false, onReveal, onLayout, highlight, fit, tokenize, options }: RendererProps<Data>): ReactElement => {
	const rubber = fit === "rubber";
	const rowHeight = options?.rowHeight ?? ROW_HEIGHT;
	const items = column.items ?? [];
	const shownAt = (it: Item<Data>): boolean => expanded || connected === undefined || connected.has(String(it.id));
	// WHAT is drawn, in board order — one entry per row, computed once. The ELEMENTS are
	// built only for the rows the window mounts (`renderRow`), so a column of 500 lines
	// never creates 500 rows to show twelve of them.
	const slots: Array<{ fold: number } | { item: Item<Data>; index: number }> = [];
	let hidden = 0;

	items.forEach((it, index) => {
		if (!shownAt(it)) {
			hidden += 1;

			return;
		}
		if (hidden > 0) {
			slots.push({ fold: hidden });
			hidden = 0;
		}
		slots.push({ item: it, index });
	});
	if (hidden > 0) slots.push({ fold: hidden });

	const renderRow = (at: number): ReactNode => {
		const slot = slots[at];
		if (slot === undefined) return null;
		if ("fold" in slot) {
			const count = slot.fold;
			const label = options?.foldLabel ?? ((n: number) => `⋯ ${n} line${n === 1 ? "" : "s"} hidden — click to show`);

			return (
				<Fold key={`hidden-${at}`} $rowHeight={rowHeight} type="button" onClick={() => onReveal?.()}>
					<FoldText>{label(count)}</FoldText>
				</Fold>
			);
		}

		return (
			<Entry key={String(slot.item.id)} data-item={String(slot.item.id)}>
				{content(slot.item, column, slot.index, render, onAction, rubber, tokenize, highlight, rowHeight)}
			</Entry>
		);
	};

	return (
		<Virtual
			count={slots.length}
			rowHeight={rowHeight}
			rubber={rubber}
			cap={column.cap === true}
			renderRow={renderRow}
			onWindow={onLayout}
			{...(options?.fullMount === undefined ? {} : { fullMount: options.fullMount })}
			{...(options?.overscan === undefined ? {} : { overscan: options.overscan })}
			{...(options?.maxHeight === undefined ? {} : { maxHeight: options.maxHeight })}
		/>
	);
};

const Canvas = styled.div`
	position: relative;
	height: 420px;
	overflow: auto;
	scrollbar-width: none;
	&::-webkit-scrollbar { width: 0; height: 0; display: none; }
`;

const Arrows = styled.svg`
	position: absolute;
	inset: 0;
	overflow: visible;
	pointer-events: none;
`;

const Node = styled.div<{ $x: number; $y: number }>`
	position: absolute;
	left: ${(p) => p.$x}px;
	top: ${(p) => p.$y}px;
	padding: 2px 6px;
	border: 1px solid ${(p) => p.theme.edge};
	border-radius: 4px;
	background: ${(p) => p.theme.panel};
	color: ${(p) => p.theme.text};
	font-family: ${(p) => p.theme.mono};
	white-space: nowrap;
`;

const arrowOf = (from: { x: number; y: number }, to: { x: number; y: number }): string => {
	const angle = Math.atan2(to.y - from.y, to.x - from.x);
	const size = 7;
	const tipX = to.x - Math.cos(angle) * 8;
	const tipY = to.y - Math.sin(angle) * 8;
	const wingX = size * Math.sin(angle);
	const wingY = size * Math.cos(angle);

	return `M ${to.x} ${to.y} L ${tipX - wingX} ${tipY + wingY} L ${tipX + wingX} ${tipY - wingY} Z`;
};

const placeOf = (it: Item<Placed>): Placed => ({ x: it.data?.x ?? 0, y: it.data?.y ?? 0 });

export const Graph = <Data extends Placed,>({ column, render }: RendererProps<Data>): ReactElement => {
	const nodes = column.items ?? [];
	const byId = new Map(nodes.map((it) => [String(it.id), it]));
	const { inner } = edgesOf(column);

	return (
		<Canvas>
			<Arrows>
				{inner.map((edge, index) => {
					const fromRef = typeof edge.from === "object" ? edge.from : { node: edge.from };
					const toRef = typeof edge.to === "object" ? edge.to : { node: edge.to };
					const from = byId.get(String(fromRef.node));
					const to = byId.get(String(toRef.node));
					if (!from || !to) return null;

					return <path key={index} d={arrowOf(placeOf(from), placeOf(to))} />;
				})}
			</Arrows>
			{nodes.map((it) => (
				<Node key={String(it.id)} data-anchor={anchorOf(it)} $x={placeOf(it).x} $y={placeOf(it).y}>
					{render ? render({ item: it, column, index: 0, mirrored: false }) : String(it.id)}
				</Node>
			))}
		</Canvas>
	);
};
