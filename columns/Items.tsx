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

const Entry = styled.div<{ $selected?: boolean }>`
	/* Every row is as wide as the WIDEST row, not just its own text: a sticky
	   plate can only slide inside its own row, so a short row must still reach the
	   right edge or its number detaches and scrolls away with the text. */
	width: 100%;
	position: relative;
	/* A selected row carries a left edge mark — the "this row is staged" cue. It is
	   drawn on the entry, not the wash, so it survives any tone. */
	${(p) => (p.$selected === true ? `box-shadow: inset 3px 0 0 ${p.theme.text};` : "")}
`;

/* The explanation of what changed, drawn UNDER the code line (a second line of the
   same row). The row grows to fit it; the virtual list measures the real height, so
   ribbons still attach to the code line, not to the explanation. */
const Change = styled.div<{ $ink?: string }>`
	padding: 0 8px 2px 52px;
	font: italic 10.5px/14px ${(p) => p.theme.mono};
	color: ${(p) => p.$ink ?? p.theme.dim};
	white-space: pre-wrap;
	word-break: break-word;
`;

/* The action gutter: a button per configured action, on the right edge of the row.
   The view draws icon + label and reports the click; it never decides the action. */
const Gutter = styled.span`
	position: absolute;
	top: 0;
	right: 0;
	display: inline-flex;
	align-items: center;
	gap: 2px;
	height: 18px;
	padding: 0 2px;
	z-index: 3;
`;

const ActionButton = styled.button`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 16px;
	padding: 0;
	border: 1px solid ${(p) => p.theme.edge};
	border-radius: 3px;
	background: ${(p) => p.theme.panel};
	color: ${(p) => p.theme.text};
	font: 10px/1 ${(p) => p.theme.mono};
	cursor: pointer;
	&:hover { background: ${(p) => p.theme.edge}; }
	&:disabled { opacity: 0.4; cursor: default; }
`;

/* The selection checkbox: a small square on the left of the plate. Clicking it
   toggles the row in the controller's selection without triggering a row click. */
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

const Line = styled.span<{ $mirrored: boolean; $rubber: boolean; $indent: number }>`
	display: flex;
	flex: 1 1 auto;
	min-width: 0;
	padding: 0 8px;
	/* A block member sits under its parent: one indent level is two spaces of the
	   code font, so a header and its styles read as a tree before any hover. */
	padding-left: ${(p) => 8 + p.$indent * 16}px;
	justify-content: flex-start;
	overflow: ${(p) => (p.$rubber ? "hidden" : "visible")};
`;

const Text = styled.span<{ $rubber: boolean; $parent?: boolean }>`
	display: inline-block;
	position: relative;
	/* A block PARENT (a header) reads as the head of its group: a touch heavier and
	   in the full text colour, so the eye finds the block before the pointer does. */
	font-weight: ${(p) => (p.$parent === true ? 600 : 400)};
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
const Paint = styled.span<{ $strong?: boolean; $paint?: string }>`
	background: ${(p) => p.$paint ?? p.theme.paint ?? "transparent"};
	border-radius: 2px;
	text-decoration: underline;
	box-decoration-break: clone;
	/* The mark is a WASH, not a repaint: the token colour underneath stays, which is what
	   makes a keyword, a string and an operator still read as themselves on a band. */
	text-shadow: ${(p) => p.theme.shadow ?? "0 1px 2px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.85)"};
	${(p) => (p.$strong === true ? "outline: 1px solid currentColor;" : "")}
`;

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

/* The label stays on the pane's left edge: a fold is as wide as the widest row,
   so without this its text scrolls out of view and reads "lick to show". */
const FoldText = styled.span`
	position: sticky;
	left: 0;
	display: inline-block;
	padding: 0 8px;
`;

const piece = (segment: { text: string; paint?: boolean; strong?: boolean; ink?: string }, at: number, paint?: string): ReactElement => {
	const ink = segment.ink === undefined ? undefined : { color: segment.ink };

	// A painted piece KEEPS its token colour and takes the mark as a wash behind it: the
	// mark says "this range is the one the lane is about", the colour says what the code
	// IS. Dropping the ink turned every marked range into the same white slab.
	return segment.paint ? (
		<Paint key={at} $strong={segment.strong === true} {...(paint === undefined ? {} : { $paint: paint })} style={ink}>{segment.text}</Paint>
	) : (
		<span key={at} style={ink}>
			{segment.text}
		</span>
	);
};

const content = <Data,>(it: Item<Data>, column: RendererProps<Data>["column"], index: number, render: RendererProps<Data>["render"], onAction: RendererProps<Data>["onAction"], rubber: boolean, tokenize: RendererProps<Data>["tokenize"], highlights: RendererProps<Data>["highlight"], rowHeight: number, tones: RendererProps<Data>["tones"]): ReactElement => {
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
	// A standing mark takes ITS ROW'S tone paint, not one flat theme colour: a unique
	// (green) value must read green on the word itself, not red on a green row.
	const rowPaint = it.tone === undefined ? undefined : tones?.[it.tone]?.paint;
	// The explanation's ink: its own tone's line colour, else the row's, else dim.
	const changeTone = it.change?.tone ?? it.tone;
	const changeInk = changeTone === undefined ? undefined : tones?.[changeTone]?.line;

	return (
		<>
			<Row $rubber={rubber} $rowHeight={rowHeight} data-anchor={anchorOf(it)}>
				{it.plate === undefined ? null : <Plate $mirrored={column.mirrored === true}>{it.plate}</Plate>}
				<Line $mirrored={column.mirrored === true} $rubber={rubber} $indent={it.indent ?? 0}>
					{/* The ANCHOR is the ROW, not the text inside it: a band measured on the line
					    box was 13px tall inside an 18px row, so the wash was a stripe with gaps and
					    a ribbon met a band thinner than the row it joins. */}
					<Text $rubber={rubber} $parent={it.blockParent === true}>
						{(segments ?? []).map((segment, at) => piece(segment, at, rowPaint))}
						{segments === undefined ? <span>{String(it.id)}</span> : null}
						{(it.notes ?? []).map((note, at) => (
							<NoteAnchor key={`note-${at}`} style={{ left: `${note.from}ch` }}>
								<Note title={note.title}>{note.text}</Note>
							</NoteAnchor>
						))}
					</Text>
				</Line>
			</Row>
			{/* WHAT HAPPENED, under the code line: "replaced X with Y", "added", "removed",
			    "moved from line N". The row grows to fit it; the virtual list measures the
			    real height, so the ribbon still attaches to the code line above. */}
			{it.change === undefined ? null : <Change {...(changeInk === undefined ? {} : { $ink: changeInk })}>{it.change.text}</Change>}
		</>
	);
};

/**
 * The default list. It HIDES every item that takes no part in a connection and
 * folds each hidden run into one button — "there was something here, open it".
 * Visibility is the board's decision (it passed `connected`), so the data source
 * never has to say which lines are folds.
 */
export const Items = <Data,>({ column, render, onAction, connected, expanded = false, onReveal, onLayout, highlight, fit, tokenize, options, tones, selected, onToggleSelect, actions, onRowAction }: RendererProps<Data>): ReactElement => {
	const rubber = fit === "rubber";
	const rowHeight = options?.rowHeight ?? ROW_HEIGHT;
	const items = column.items ?? [];
	// The row-scoped actions: a gutter button per action on each row. The view draws
	// icon + label and reports the click; the controller performs it.
	const rowActions = (actions ?? []).filter((action) => (action.scope ?? "row") === "row");
	const shownAt = (it: Item<Data>): boolean => expanded || connected === undefined || connected.has(String(it.id));
	// WHAT is drawn, in board order — one entry per row, computed once. The ELEMENTS are
	// built only for the rows the window mounts (`renderRow`), so a column of 500 lines
	// never creates 500 rows to show twelve of them.
	const slots: Array<{ fold: number; ids: string[] } | { item: Item<Data>; index: number }> = [];
	let hidden = 0;
	let hiddenIds: string[] = [];

	items.forEach((it, index) => {
		if (!shownAt(it)) {
			hidden += 1;
			hiddenIds.push(String(it.id));

			return;
		}
		if (hidden > 0) {
			slots.push({ fold: hidden, ids: hiddenIds });
			hidden = 0;
			hiddenIds = [];
		}
		slots.push({ item: it, index });
	});
	if (hidden > 0) slots.push({ fold: hidden, ids: hiddenIds });

	const renderRow = (at: number): ReactNode => {
		const slot = slots[at];
		if (slot === undefined) return null;
		if ("fold" in slot) {
			const count = slot.fold;
			const label = options?.foldLabel ?? ((n: number) => `⋯ ${n} line${n === 1 ? "" : "s"} hidden — click to show`);

			return (
				<Fold key={`hidden-${at}`} $rowHeight={rowHeight} type="button" onClick={() => onReveal?.()}>
					{/* A folded run still ADDRESSES every row it hides: a lane whose end is
					    folded routes to this button (the rows' shared box) instead of
					    vanishing or pointing at a row that is not on screen. The anchors are
					    zero-width so they add no layout; the button's own box is what the
					    geometry measures, and it is re-measured when the fold opens. */}
					{slot.ids.map((id) => (
						<span key={id} data-anchor={id} style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
					))}
					<FoldText>{label(count)}</FoldText>
				</Fold>
			);
		}

		const id = String(slot.item.id);
		const isSelected = selected?.has(id) === true;

		return (
			<Entry key={id} data-item={id} $selected={isSelected}>
				{/* The selection checkbox: toggles the row in the controller's selection.
				    It stops propagation so it is not also read as a row click. */}
				{onToggleSelect === undefined ? null : (
					<SelectBox
						type="button"
						$on={isSelected}
						data-action="select"
						title={isSelected ? "deselect row" : "select row"}
						onClick={(event) => {
							event.stopPropagation();
							onToggleSelect(id);
						}}
					>
						{isSelected ? "✓" : ""}
					</SelectBox>
				)}
				{content(slot.item, column, slot.index, render, onAction, rubber, tokenize, highlight, rowHeight, tones)}
				{/* The action gutter: a button per configured row action. */}
				{rowActions.length === 0 ? null : (
					<Gutter>
						{rowActions.map((action) => (
							<ActionButton
								key={action.id}
								type="button"
								data-action={action.id}
								title={action.label}
								disabled={action.disabled?.({ column: column.id, item: id }) === true}
								onClick={(event) => {
									event.stopPropagation();
									onRowAction?.(action, id);
								}}
							>
								{action.icon ?? action.label.slice(0, 1)}
							</ActionButton>
						))}
					</Gutter>
				)}
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
			bounded={options?.boardHeight !== undefined}
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
