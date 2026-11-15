import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from "react";
import styled, { ThemeProvider } from "styled-components";
import type { BoardAction, Column, Connection, Fit, LaneMark, Renderer, RowRef, Theme, ViewProps } from "../interface/types.js";
import { layoutColumn, layoutLookup, measureLayout, readScrollTops, type Layout } from "../geometry/measure.js";
import { anchorOf } from "../columns/column.js";
import { shapesOf, type ToneLookup } from "../geometry/ribbon.js";
import { resolveOptions } from "../config.js";
import { useSyncedScroll } from "./scroll.js";

/**
 * ── THE BOARD ───────────────────────────────────────────────────────────────
 *
 * N columns, a corridor after some of them, one layer of shapes on top. It knows
 * the columns, the lanes and the corridor widths — and nothing else. The frame's
 * colours and font are a `theme` PROP: this package draws nothing in colours it
 * chose itself.
 *
 * SCROLLING NEVER RE-RENDERS THE BOARD. A layout is measured ONCE (per change of
 * content or size) with the scroll taken out of every box. A scroll then only
 * REPAINTS: one pass over the lanes whose ends are on screen, writing `d` into
 * nodes that already exist. Nothing is measured per frame, nothing is reconciled
 * per frame, and no node is ever created twice.
 */

const Frame = styled.div<{ $template: string; $height?: string | undefined }>`
	position: relative;
	display: grid;
	grid-template-columns: ${(p) => p.$template};
	/* A bounded board constrains its single row to the board height, so every column
	   scrolls INSIDE it instead of stretching the row to its content. Unbounded, the
	   row is as tall as the tallest column. */
	grid-template-rows: ${(p) => (p.$height === undefined ? "auto" : "minmax(0, 1fr)")};
	align-items: ${(p) => (p.$height === undefined ? "start" : "stretch")};
	width: 100%;
	min-width: 0;
	${(p) => (p.$height === undefined ? "" : `height: ${p.$height};`)}
	overflow: hidden;
	font-family: ${(p) => p.theme.mono};
	font-size: 12px;
	background: ${(p) => p.theme.paper};
`;

// The columns sit ABOVE the shapes: a band is a background, never a curtain over
// the text. The layer is a sibling with a lower z-index, so a lane is visible in
// the corridors and behind the code.
// A capped column takes no part in sizing the row (`height: 0` contributes nothing)
// and then grows back to the row it did not set — so its list scrolls inside the
// board height the OTHER columns made.
const Cell = styled.div<{ $cap: boolean; $bounded: boolean }>`
	position: relative;
	z-index: 2;
	min-width: 0;
	/* Bounded: the cell fills the board's constrained row and never grows past it,
	   so its pane scrolls inside the board instead of stretching the page. */
	${(p) => (p.$bounded ? "height: 100%; min-height: 0; overflow: hidden;" : "")}
	${(p) => (p.$cap && !p.$bounded ? "height: 0; min-height: 100%;" : "")}
`;

const Corridor = styled.div`
	min-width: 0;
`;

/* The action toolbar: a strip above the board holding the owner's toolbar-scoped
   actions (apply-left, apply-right, stage, …). The view draws icon + label and
   reports the click; the controller performs it. */
const Toolbar = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	padding: 6px 8px;
	border-bottom: 1px solid ${(p) => p.theme.edge};
	background: ${(p) => p.theme.panel};
	font-family: ${(p) => p.theme.mono};
	font-size: 11px;
`;

const ToolbarButton = styled.button`
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 3px 9px;
	border: 1px solid ${(p) => p.theme.edge};
	border-radius: 5px;
	background: ${(p) => p.theme.paper};
	color: ${(p) => p.theme.text};
	font: inherit;
	cursor: pointer;
	&:hover { background: ${(p) => p.theme.edge}; }
	&:disabled { opacity: 0.4; cursor: default; }
`;

const ToolbarCount = styled.span`
	margin-left: auto;
	color: ${(p) => p.theme.dim};
`;

// THE LAYER IS IMPERATIVE. Its children are written by `paint()`, never reconciled:
// a lane keeps its nodes for the whole life of the board, so a board that has been
// scrolled for an hour owns exactly as many paths as it did at the start.
// A lane under the pointer: the whole connection the hovered row takes part in
// simply gets brighter. No scaling — a grown shape reads as a different shape,
// and the point here is only "these pieces belong together".
const Layer = styled.svg`
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	overflow: hidden;
	pointer-events: none;

	& [data-lane] {
		cursor: pointer;
	}
	& [data-lane] path {
		pointer-events: auto;
		transition: filter 120ms ease;
	}
	& [data-lane][data-hot="true"] path {
		/* The same hue, laid down twice — the lane reads as deeper, never as another colour. */
		transition: none;
	}
	& text {
		pointer-events: auto;
		cursor: default;
	}
	/* The caption belongs to its lane: when the lane lights, its words do too. */
	& [data-caption][data-hot="true"] {
		fill: ${(p) => p.theme.text};
	}
`;

/**
 * WHICH CHARACTER of a row the pointer is over. The board highlights a RANGE, and
 * "the piece under the pointer" is a range too — a row can carry a dozen of them
 * (`const paginated = paginate(results, cursor, limit)` has four), so the row alone is
 * not precise enough to say what is being pointed at.
 *
 * The offset is the character inside the row's text, counted over its text nodes, and
 * it comes from the browser's caret, not from measuring glyphs.
 */
const charAt = (row: HTMLElement | null, x: number, y: number): number | undefined => {
	if (row === null) return undefined;
	const doc = document as Document & {
		caretPositionFromPoint?: (cx: number, cy: number) => { offsetNode: Node | null; offset: number } | null;
		caretRangeFromPoint?: (cx: number, cy: number) => Range | null;
	};
	const position = doc.caretPositionFromPoint?.(x, y) ?? null;
	const node = position?.offsetNode ?? doc.caretRangeFromPoint?.(x, y)?.startContainer ?? null;
	const offset = position?.offset ?? doc.caretRangeFromPoint?.(x, y)?.startOffset ?? 0;
	if (node === null || !row.contains(node)) return undefined;

	let total = 0;
	const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
	for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
		if (current === node) return total + offset;
		total += (current.textContent ?? "").length;
	}

	return undefined;
};

const templateOf = <Data,>(columns: readonly Column<Data>[], corridors: readonly (number | undefined)[], fit: Fit | undefined): string =>
	columns
		.map((column, index) => {
			const width =
				column.ratio !== undefined
					? `${column.ratio}fr`
					: column.width === undefined
						? "minmax(0, 1fr)"
						: `${column.width}px`;
			const corridor = corridors[index];
			if (corridor === undefined) return width;

			// Rubber: the corridor may shrink below its asked width, so on a narrow
			// screen it gives room back to the columns instead of forcing a scroll.
			return fit === "rubber" ? `${width} minmax(0, ${corridor}px)` : `${width} ${corridor}px`;
		})
		.join(" ");

const Group = ({ children }: { children: ReactNode }): ReactElement => <>{children}</>;

const NS = "http://www.w3.org/2000/svg";

/** One lane's nodes, owned by the board and reused on every repaint. */
interface LaneNode {
	readonly group: SVGGElement;
	readonly caption: SVGTextElement;
}

export const Surface = <Data,>({ columns, connections = [], blocks = [], corridors = [], sync = [], reveal = false, tones = {}, renderers = {}, render, theme, onAction, fit, tokenize, options, controller }: ViewProps<Data>): ReactElement => {
	// The display knobs, resolved once: the owner's overrides on top of the defaults.
	const config = useMemo(() => resolveOptions(options), [options]);
	// THE LAYOUT, NOT THE SCROLL: measured boxes with the scroll taken out, so a
	// scroll only repaints. Re-measured when the content or the size changes.
	const [layout, setLayout] = useState<Layout | null>(null);
	const [revealed, setRevealed] = useState(reveal);
	// The row under the pointer: a column id and an item id. Only ids — the same
	// currency the connections are written in.
	const [hover, setHover] = useState<{ column: string; item: string; char?: number } | null>(null);
	// The last hover, read synchronously by the pointer handler so `onRowHover` fires
	// once per row change (never inside a state updater).
	const hoverRef = useRef<{ column: string; item: string; char?: number } | null>(null);
	// The LANE under the pointer: the connection's own index. A lane is how the reader
	// says "this row and that row are the same thing", so the pointer names a LANE and
	// the highlight is the occurrence that lane stands for.
	const [laneHover, setLaneHover] = useState<number | null>(null);
	// The connection the reader clicked: the board narrows to its chain, and the
	// "N lines hidden — click to show" button brings the rest back. A controller may
	// own this state (`controller.picked`); otherwise the view keeps it internally.
	const [internalPicked, setPicked] = useState<{ column: string; item: string } | null>(null);
	const picked = controller?.picked !== undefined ? controller.picked : internalPicked;
	// The SELECTED rows (controlled): independent of the focused chain. A reader can
	// select rows 1, 2, 5, 7 and stage them while 4 and 6 stay out. The view draws a
	// selection mark and reports toggles; the controller owns the set.
	const selected = controller?.selected ?? [];
	const selectedSet = useMemo(() => new Set(selected.map((ref) => `${ref.column}\u0000${ref.item}`)), [selected]);
	const root = useRef<HTMLDivElement | null>(null);
	const layer = useRef<SVGSVGElement | null>(null);
	// Pointer moves are coalesced to at most one update per frame (see onPointerOver).
	const lastPointerApply = useRef(0);
	const pendingPointer = useRef<{ target: HTMLElement; x: number; y: number } | null>(null);
	// Lane nodes, keyed by the CONNECTION's own index: a lane keeps its node for the
	// whole life of the board, and a repaint only rewrites what it already owns.
	const laneNodes = useRef(new Map<number, LaneNode>());
	// The row wash, in its own layer: merged spans painted once per column and tone, so
	// nested lanes cannot stack their transparency into a white rectangle.
	const bandLayer = useRef<SVGGElement | null>(null);
	// THE RIBBON GEOMETRY, CACHED. Measuring every lane and allocating its slot is the
	// expensive part of a paint, and it does NOT depend on the pointer — only on the
	// connections, the layout and the scroll. A hover changes the wash, not the roads,
	// so the shapes are reused until one of those moves. This is what keeps a hover
	// from re-measuring a hundred lanes on every pointer move.
	const shapeCache = useRef<{ key: string; placed: ReturnType<typeof shapesOf> } | null>(null);

	// REVEAL, controlled or internal. When the controller owns it (`controller.reveal`
	// is not undefined) the view shows EXACTLY that state — the owner's "only blocks /
	// show all" chip and the board can never disagree, and a toggle always recomputes
	// the layout (the measure effect keys on `revealed`). Otherwise the `reveal` prop
	// is the initial state and the view owns it internally.
	const controlledReveal = controller?.reveal;
	const revealedNow = controlledReveal !== undefined ? controlledReveal : revealed;
	useEffect(() => setRevealed(reveal), [reveal]);

	// A different board (another tab, another pair) has different connections: a pick
	// made on the old one would hide everything here.
	useEffect(() => setPicked(null), [connections, columns]);

	// A repaint always reads the CURRENT geometry and handlers, never the ones of the
	// render that installed the scroll listener.
	const paintRef = useRef<() => void>(() => {});

	// THE LAST LAYOUT, BY VALUE. A measurement is a fresh object every time, so
	// `setLayout` always looked like a change and the board always re-rendered — and a
	// render can move a box, the observer measures again, and the tab spins at 100% CPU.
	// It started the moment a fold was opened (every column changed height at once).
	// A layout is a pure function of the boxes, so the same boxes mean the same render.
	const lastLayout = useRef("");
	const keyOf = (next: Layout): string => {
		const box = (id: string, value: { top: number; bottom: number; left: number; right: number }): string =>
			`${id}:${value.top.toFixed(2)},${value.bottom.toFixed(2)},${value.left.toFixed(2)},${value.right.toFixed(2)}`;

		return `${[...next.columns.entries()].map(([id, value]) => box(id, value)).join("|")}#${[...next.anchors.entries()].map(([id, value]) => box(id, value)).join("|")}`;
	};

	// STABLE, because a renderer re-subscribes its own observers when this identity
	// changes — and it changes on every render if it is written inline.
	const measure = useCallback((): void => {
		const element = root.current;
		if (element === null) return;
		const next = measureLayout(element, config.bandGap);
		const key = keyOf(next);
		if (key === lastLayout.current) return;
		lastLayout.current = key;
		setLayout(next);
	}, [config.bandGap]);

	// A STABLE signature of the board's identity: which columns, which rows, which lanes.
	// The props are fresh arrays on every render, so they cannot key an effect directly;
	// this string changes only when the board itself changes (another tab, another pair).
	const boardKey = useMemo(() => {
		const cols = columns.map((column) => `${column.id}:${(column.items ?? []).map((it) => String(it.id)).join(",")}`).join("|");
		const conns = connections.map((connection) => connection.id).join(",");

		return `${cols}#${conns}`;
	}, [columns, connections]);

	useLayoutEffect(() => {
		const element = root.current;
		if (!element) return undefined;

		// A NEW BOARD (another tab, another pair) must re-measure from scratch. The layout
		// key is a value-hash of the boxes; after a switch the new columns can hash to the
		// SAME key as the old board (same ids, same row heights), so `measure` would bail
		// and keep the previous board's layout — the roads then point at rows that are not
		// there (zero lanes until a fold is opened). Forgetting the key here guarantees the
		// first measure of a new board always lands.
		lastLayout.current = "";
		measure();

		// A column that changes its MOUNTED RANGE (virtual scroll) or its size changes
		// which anchors exist — the layer is re-measured then, and only then.
		const observer = new ResizeObserver(() => measure());
		observer.observe(element);
		for (const child of element.querySelectorAll("[data-column]")) observer.observe(child);

		// A TAB OR PAIR SWITCH settles one frame late: the new columns mount, the virtual
		// window decides its range, and only THEN are the real boxes on screen. The first
		// measure above can run against a half-mounted board (zero lanes until a resize).
		// Re-measure after the commit settles — rAF for a visible tab, a timeout fallback
		// for a hidden one where rAF is throttled — so the roads always find their rows.
		let frame = 0;
		const settle = (): void => {
			frame = 0;
			measure();
		};
		frame = requestAnimationFrame(settle);
		const timer = setTimeout(settle, 60);

		return () => {
			observer.disconnect();
			if (frame !== 0) cancelAnimationFrame(frame);
			clearTimeout(timer);
		};
	}, [boardKey, revealedNow, picked, measure]);

	// SCROLL → REPAINT. No state, no measurement: the offset is the only thing that
	// moved, and every box is `content position − scroll offset`.
	useLayoutEffect(() => {
		const element = root.current;
		if (!element) return undefined;

		let frame = 0;
		const onScroll = (): void => {
			if (frame !== 0) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				paintRef.current();
			});
		};
		element.addEventListener("scroll", onScroll, true);

		return () => {
			element.removeEventListener("scroll", onScroll, true);
			if (frame !== 0) cancelAnimationFrame(frame);
		};
	}, []);

	useSyncedScroll(root, sync);

	const refs = new Map<string, string>();
	// anchor → id, so a row under the pointer resolves to the item it stands for.
	const idsByAnchor = new Map<string, string>();
	// EVERY id the board actually carries, per column. A connection is a claim about
	// ids; an id no column holds is not a row, it is a bug in the data. The board
	// refuses to draw a road to nowhere: such ids are dropped from the lane below.
	const knownIds = new Map<string, Set<string>>();
	for (const column of columns) {
		const set = new Set<string>();
		for (const it of column.items ?? []) {
			refs.set(`${column.id}\u0000${String(it.id)}`, anchorOf(it));
			idsByAnchor.set(`${column.id}\u0000${anchorOf(it)}`, String(it.id));
			set.add(String(it.id));
		}
		knownIds.set(column.id, set);
	}
	// THE CONNECTIONS, SANITISED. Every end keeps only ids its column actually carries,
	// and an end left empty (or a lane left with fewer than two ends) is dropped — a
	// ribbon needs two real rows to join. This is what makes "no nonexistent ids" a
	// structural guarantee rather than a hope about the data: a lane that names a ghost
	// row simply does not exist on the board, instead of drawing a broken road.
	const lanes = useMemo(() => {
		const out: Connection[] = [];
		for (const connection of connections) {
			const ends = connection.ends
				.map((end) => ({ column: end.column, items: end.items.filter((id) => knownIds.get(end.column)?.has(String(id)) === true) }))
				.filter((end) => end.items.length > 0);
			if (ends.length < 2) continue;
			out.push(ends.length === connection.ends.length && ends.every((end, at) => end.items.length === connection.ends[at]?.items.length) ? connection : { ...connection, ends });
		}

		return out;
		// knownIds is rebuilt from columns each render; the sanitised lanes only change
		// when the columns or the connections do.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connections, columns]);
	// How many lanes an id takes part in. An id in MANY lanes is a HUB (a summary row
	// that stands for a whole kind); walking through it would light every row of that
	// kind, which is not what the pointer asked for.
	const laneCounts = new Map<string, number>();
	for (const connection of lanes) {
		for (const end of connection.ends) {
			for (const id of end.items) {
				const key = `${end.column}\u0000${String(id)}`;
				laneCounts.set(key, (laneCounts.get(key) ?? 0) + 1);
			}
		}
	}
	const HUB_LANES = config.hubLanes;

	// The CHAIN of one id: the lanes it belongs to, and — from a lane — only ids that are
	// not hubs. A hub stands for many rows, so passing through it would highlight rows
	// the pointer never touched.
	const chainOf = (seed: { column: string; item: string }): Set<string> => {
		const chain = new Set<string>();
		const seen = new Set([`${seed.column}\u0000${seed.item}`]);
		const queue = [seed];
		while (queue.length > 0) {
			const at = queue.shift() as { column: string; item: string };
			for (const connection of lanes) {
				if (chain.has(connection.id)) continue;
				const joined = connection.ends.some((end) => end.column === at.column && end.items.some((id) => String(id) === at.item));
				if (!joined) continue;
				chain.add(connection.id);
				for (const end of connection.ends) {
					// Only an end naming ONE non-hub id is "the same thing, over there". An end
					// that lists many ids is "all of these live here" — walking it would light
					// every sibling of the row under the pointer.
					if (end.items.length !== 1) continue;
					const key = `${end.column}\u0000${String(end.items[0])}`;
					if (seen.has(key)) continue;
					if ((laneCounts.get(key) ?? 0) >= HUB_LANES) continue;
					seen.add(key);
					queue.push({ column: end.column, item: String(end.items[0]) });
				}
			}
		}

		return chain;
	};

	// Hovering does NOT walk: the pointer names a lane, or a row, and the lanes that name
	// THAT row are lit. Walking from a row through every lane it belongs to is what
	// turned one `Identifier` into the whole board — a row named by five lanes is a hub,
	// not a chain. A CLICK still narrows to the whole chain: filtering is about "what else
	// is this tied to", not about "what am I pointing at".
	const focus = picked === null ? null : chainOf(picked);

	// Which ids take part in a connection, per column. Everything else is hidden
	// by the board — the data source never has to know about folding. A picked chain
	// replaces that map, so every column outside it starts with an empty set.
	const connected = new Map<string, Set<string>>();
	const shown = focus === null ? lanes : lanes.filter((connection) => focus.has(connection.id));
	if (focus !== null) for (const column of columns) connected.set(column.id, new Set<string>());
	for (const connection of shown) {
		for (const end of connection.ends) {
			const set = connected.get(end.column) ?? new Set<string>();
			for (const id of end.items) set.add(String(id));
			connected.set(end.column, set);
		}
	}

	// WHICH CODE LINE a row stands for: its own id, unless the row says otherwise (a tree
	// row names a construct written on a code line). Built once per columns identity.
	const lineMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const column of columns) {
			for (const item of column.items ?? []) {
				if (item.line !== undefined) map.set(`${column.id}\u0000${String(item.id)}`, item.line);
			}
		}

		return map;
	}, [columns]);
	const lineOf = (column: string, id: string): string => lineMap.get(`${column}\u0000${String(id)}`) ?? String(id);

	// The lanes the pointer focuses, by their index in `shown`. On a ROW the pointer also
	// knows the character it is on, and then only the NARROWEST piece under it counts:
	// `const` on a line with four marked pieces is not the `call` above it, and the
	// enclosing blocks mark the same characters — they do not own this one.
	const hoverLine = hover === null ? null : lineOf(hover.column, hover.item);
	const atPointer = (marks: readonly LaneMark[] | undefined): LaneMark | null => {
		if (marks === undefined || hover === null || hoverLine === null || hover.char === undefined) return null;
		const at = hover;
		const char: number = at.char ?? 0;
		let best: LaneMark | null = null;
		for (const mark of marks) {
			// The range has to be on THIS row: same number in the other column is another word
			// (`type: "dom-action"` on the left, `text: "Scrolled…"` on the right, same offsets).
			if (mark.column !== at.column || String(mark.line) !== hoverLine) continue;
			if (mark.from > char || char >= mark.to) continue;
			if (best === null || mark.to - mark.from < best.to - best.from) best = mark;
		}

		return best;
	};
	const nearRow = laneHover !== null
		? []
		: hover === null
			? []
			: shown.map((connection, index) => (connection.ends.some((end) => end.column === hover.column && end.items.some((id) => String(id) === hover.item)) ? index : -1)).filter((index) => index >= 0);
	// The piece the pointer is ON, if it says: the smallest range it contains. Every lane
	// that marks exactly that range owns it; the enclosing blocks stay quiet.
	const piece = laneHover === null && hover !== null ? nearRow.map((index) => atPointer(shown[index]?.marks)).find((range) => range !== null) ?? null : null;
	// The lane that OWNS the piece: every enclosing block also marks the same characters,
	// so "marks this range" is not enough — the most specific lane is the one with the
	// fewest marks, and only it lights.
	const owners = piece === null
		? []
		: nearRow.filter((index) => (shown[index]?.marks ?? []).some((mark) => String(mark.line) === hoverLine && mark.from === (piece as { from: number }).from && mark.to === (piece as { to: number }).to));
	// ONE LANE, NOT TEN. A row takes part in a dozen nested lanes (`return` ⊃ `call` ⊃
	// `func` ⊃ the whole block), so lighting every lane that names the row turned ten
	// ribbons bright at once — which is as unreadable as lighting none. The pointer
	// names ONE lane: the most specific one, measured by how few ranges it holds.
	const marksOf = (index: number): number => (shown[index]?.marks ?? []).length;
	const narrowest = (indices: readonly number[]): number[] => {
		let best: number | null = null;
		for (const index of indices) if (best === null || marksOf(index) < marksOf(best)) best = index;

		return best === null ? [] : [best];
	};
	// A LANE THAT MARKS THIS ROW comes before one that merely names it: `limit` sits on a row
	// the `returns` lane also joins, and the fewer-marks rule picked that empty lane while
	// the callback-parameter lane — the one that actually marks `limit` — stayed dark.
	const onRow = nearRow.filter((index) => (shown[index]?.marks ?? []).some((mark) => hover !== null && mark.column === hover.column && String(mark.line) === hoverLine));
	const focused = laneHover !== null
		? shown.map((_, index) => index).filter((index) => index === laneHover)
		: piece === null
			? narrowest(onRow.length > 0 ? onRow : nearRow)
			: narrowest(owners);
	const hotIndices = new Set(focused);
	// WHERE the focused lanes are written: the exact ranges to underline, per column and
	// row. Nothing is searched for — the range came with the lane.
	//
	// POINTING AT A ROW IS NOT POINTING AT A LANE. Hovering a lane asks "where is this
	// lane written", and the answer is every range the lane holds. Hovering a ROW asks
	// "which range is THIS row", and answering with the whole lane's ranges lit the
	// entire block under the pointer. A row hover lights only what sits on that row.
	const highlights = new Map<string, Map<string, { from: number; to: number; strong: boolean; ink?: string }[]>>();
	const addHighlight = (mark: { column: string; line: string; from: number; to: number; ink?: string }): void => {
		const rows = highlights.get(mark.column) ?? new Map<string, { from: number; to: number; strong: boolean; ink?: string }[]>();
		const list = rows.get(String(mark.line)) ?? [];
		list.push({ from: mark.from, to: mark.to, strong: true, ...(mark.ink === undefined ? {} : { ink: mark.ink }) });
		rows.set(String(mark.line), list);
		highlights.set(mark.column, rows);
	};
	// A LANE LIGHTS AS ONE WHOLE PATH. Wherever the pointer enters it — a code word, a
	// middle summary row, the ribbon itself — EVERY range the lane holds in EVERY column
	// lights, plus each range's twin. Narrowing the wash to the hovered row/column made
	// the rest of the correspondence go dark mid-path ("pieces extinguish on hover") and
	// left a middle-column hover lighting nothing at all. The lane is the unit; the
	// pointer only chooses WHICH lane, never which fragment of it.
	for (const index of focused) {
		for (const mark of shown[index]?.marks ?? []) {
			addHighlight(mark);
			// AND ITS DUPLICATE: the range this one was paired with on the other side. Hovering
			// a name has to light the SAME name over there, not the row it sits in.
			if (mark.twin !== undefined) addHighlight(mark.twin);
		}
	}
	// A connection names item IDS, but the DOM carries ANCHORS. They differ for
	// any item that sets one (e.g. a folded run), so `layoutLookup` falls back to the
	// anchor when the id has one of its own.
	const ribbonColumns = columns.map((column) => ({
		id: column.id,
		box: layoutColumn(layout, column.id),
	}));

	// ── THE PAINT ───────────────────────────────────────────────────────────
	//
	// One pass over the lanes whose ends are on screen. The slot allocator is the one
	// in `ribbon.ts` and it is NOT touched here: this only writes the paths it returns
	// into nodes that already exist, keyed by the CONNECTION's own index.
	// THE ROW TONES, in one map: a row may say it does NOT correspond (`differs`)
	// while the lane it belongs to does. Built once per columns identity, so a scroll
	// only reads it.
	const toneMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const column of columns) {
			for (const item of column.items ?? []) {
				if (item.tone !== undefined) map.set(`${column.id}\u0000${String(item.id)}`, item.tone);
			}
		}

		return map;
	}, [columns]);
	const toneOf: ToneLookup = (column, id) => toneMap.get(`${column}\u0000${String(id)}`) ?? null;

	// ── BLOCKS ──────────────────────────────────────────────────────────────
	//
	// A block is "these rows are one unit" (a header + its members), independent of
	// the lanes. The owner grouped the rows; the view only draws the grouping:
	// members indented under their parent (the renderer does that from `item.indent`),
	// and — when the pointer is on ANY row of a block — the WHOLE block lit, parent
	// included, in every column the block names. A block is found by the row under
	// the pointer (or the lane under the pointer, via its ends).
	const blockRows = useMemo(() => {
		// column → item id → block id, and the reverse: block id → its rows per column.
		const byRow = new Map<string, string>();
		const rowsOfBlock = new Map<string, Map<string, string[]>>();
		const parentsOfBlock = new Map<string, Set<string>>();
		const toneOfBlock = new Map<string, string>();
		// A CODE LINE may be named by several nested blocks (a component usage line is
		// the anchor of its own subtree AND of every ancestor subtree). Index the blocks
		// that name each code line, smallest first, so a hover resolves to the most
		// specific one — the component's own subtree, not the whole page that contains it.
		const byCodeLine = new Map<string, string[]>();
		const sizeOf = new Map<string, number>();
		for (const block of blocks) {
			const perColumn = new Map<string, string[]>();
			const parents = new Set<string>();
			let size = 0;
			const add = (end: { column: string; items: readonly (string | number)[] }, isParent: boolean) => {
				const list = perColumn.get(end.column) ?? [];
				for (const id of end.items) {
					const key = `${end.column}\u0000${String(id)}`;
					byRow.set(key, block.id);
					list.push(String(id));
					size += 1;
					if (isParent) parents.add(key);
				}
				perColumn.set(end.column, list);
			};
			for (const end of block.parent) add(end, true);
			for (const end of block.members ?? []) add(end, false);
			rowsOfBlock.set(block.id, perColumn);
			parentsOfBlock.set(block.id, parents);
			sizeOf.set(block.id, size);
			if (block.tone !== undefined) toneOfBlock.set(block.id, block.tone);
			// Index by the code lines this block names (columns "0" and the last code
			// column carry source lines; a snapshot row's `line` is its code line too).
			for (const [column, ids] of perColumn) {
				for (const id of ids) {
					const line = lineMap.get(`${column}\u0000${id}`) ?? id;
					const key = `${column}\u0000${line}`;
					const list = byCodeLine.get(key) ?? [];
					if (!list.includes(block.id)) list.push(block.id);
					byCodeLine.set(key, list);
				}
			}
		}
		// Smallest block first: the most specific subtree owns the code line.
		for (const list of byCodeLine.values()) list.sort((a, b) => (sizeOf.get(a) ?? 0) - (sizeOf.get(b) ?? 0));

		return { byRow, rowsOfBlock, parentsOfBlock, toneOfBlock, byCodeLine };
	}, [blocks, lineMap]);

	// The block the pointer is on, plus its ANCESTOR blocks (so every parent up the
	// tree lights, not just the immediate group). A snapshot row names its block
	// directly; a CODE LINE names several nested blocks and resolves to the smallest
	// (the component's own subtree). Ancestors are the blocks that contain the hovered
	// block's parent row — the chain of containers up to the root.
	const hoveredBlocks = useMemo((): string[] => {
		let found: string | null = null;
		if (hover !== null) {
			const direct = blockRows.byRow.get(`${hover.column}\u0000${hover.item}`);
			if (direct !== undefined) found = direct;
			else {
				const line = lineOf(hover.column, hover.item);
				const candidates = blockRows.byCodeLine.get(`${hover.column}\u0000${line}`);
				if (candidates !== undefined && candidates.length > 0) found = candidates[0] ?? null;
			}
		}
		if (found === null && laneHover !== null) {
			const lane = shown[laneHover];
			for (const end of lane?.ends ?? []) {
				for (const id of end.items) {
					const hit = blockRows.byRow.get(`${end.column}\u0000${String(id)}`);
					if (hit !== undefined) {
						found = hit;
						break;
					}
				}
				if (found !== null) break;
			}
		}
		if (found === null) return [];
		const primary: string = found;

		// Walk up: a block is an ancestor of the primary if it names the primary's
		// parent row (in any column) among its own rows. Collect the chain, choosing
		// the SMALLEST containing block each step (the immediate parent, not the root).
		const chain: string[] = [primary];
		const seen = new Set<string>(chain);
		let current: string = primary;
		for (let guard = 0; guard < 64; guard += 1) {
			const parents = blockRows.parentsOfBlock.get(current);
			if (parents === undefined || parents.size === 0) break;
			let next: string | null = null;
			let nextSize = Infinity;
			for (const [blockId, perColumn] of blockRows.rowsOfBlock) {
				if (seen.has(blockId)) continue;
				let contains = false;
				for (const key of parents) {
					const [column, id] = key.split("\u0000");
					if (id !== undefined && (perColumn.get(column ?? "") ?? []).includes(id)) {
						contains = true;
						break;
					}
				}
				if (!contains) continue;
				const size = [...perColumn.values()].reduce((n, ids) => n + ids.length, 0);
				if (size < nextSize) {
					nextSize = size;
					next = blockId;
				}
			}
			if (next === null) break;
			chain.push(next);
			seen.add(next);
			current = next;
		}

		return chain;
	}, [hover, laneHover, shown, blockRows, lineMap]);

	const paint = (): void => {
		const svg = layer.current;
		const element = root.current;
		if (svg === null || element === null || layout === null) return;

		// id → anchor, because a lane names the item's id and the DOM carries its anchor.
		const anchorOfId = (column: string, id: string): string => refs.get(`${column}\u0000${id}`) ?? id;
		const scrollTops = readScrollTops(element);
		const lookup = layoutLookup(layout, scrollTops, anchorOfId);
		// The geometry key: the connections, the measured layout and the scroll. A hover
		// changes none of these, so the cached shapes are reused and only the wash repaints.
		const geoKey = `${shown.length}:${shown.map((c) => c.id).join(",")}|${lastLayout.current}|${[...scrollTops.entries()].map(([id, top]) => `${id}:${top}`).join(",")}`;
		let placed: ReturnType<typeof shapesOf>;
		if (shapeCache.current !== null && shapeCache.current.key === geoKey) {
			placed = shapeCache.current.placed;
		} else {
			placed = shapesOf(shown, ribbonColumns, lookup, toneOf);
			shapeCache.current = { key: geoKey, placed };
		}
		const alive = new Set<number>();

		// ── THE ROW WASH, ONCE ────────────────────────────────────────────────
		//
		// A lane's band says "these rows are on this lane". Nested lanes cover the SAME
		// rows (`return` ⊃ `call` ⊃ `func`), and a transparent fill is not idempotent —
		// five copies of the wash turned a row white. So every row is painted EXACTLY
		// ONCE: the spans are merged per column, and a row that is hot (the pointed-at
		// lane, or the hovered block's header) takes the `hot` fill INSTEAD of the base
		// fill, never on top of it. No alpha ever stacks.
		type Span = { top: number; bottom: number };
		type SpanSet = { column: string; tone: string; spans: Span[] };
		const spansOf = new Map<string, SpanSet>();
		const hotSpansOf = new Map<string, SpanSet>();
		const addSpan = (target: Map<string, SpanSet>, column: string, tone: string, span: Span): void => {
			const key = `${column}\u0000${tone}`;
			const entry = target.get(key) ?? { column, tone, spans: [] };
			entry.spans.push(span);
			target.set(key, entry);
		};
		for (const { index, shape } of placed) {
			const hot = hotIndices.has(index);
			for (const band of shape.bands) {
				addSpan(hot ? hotSpansOf : spansOf, band.column, band.tone ?? shape.tone, { top: band.top, bottom: band.bottom });
			}
		}

		// ── THE HOVERED BLOCKS ──────────────────────────────────────────────────
		//
		// A block is one unit (a header + its members). When the pointer is on any of
		// its rows, the WHOLE block is washed in every column it names — the parent
		// included — AND every ancestor block up the tree. The primary (most specific)
		// block's rows are HOT; ancestors take the base fill. Each row is still painted
		// once: a hot row is removed from the base set below, not layered over it.
		if (hoveredBlocks.length > 0) {
			for (let depth = hoveredBlocks.length - 1; depth >= 0; depth -= 1) {
				const blockId = hoveredBlocks[depth];
				if (blockId === undefined) continue;
				const perColumn = blockRows.rowsOfBlock.get(blockId);
				const parents = blockRows.parentsOfBlock.get(blockId) ?? new Set<string>();
				if (perColumn === undefined) continue;
				const blockTone = blockRows.toneOfBlock.get(blockId) ?? "same";
				const isPrimary = depth === 0;
				for (const [column, ids] of perColumn) {
					for (const id of ids) {
						const box = lookup(column, id);
						if (box === null) continue;
						const span = { top: box.top, bottom: box.bottom };
						// The primary block (and any block's header) is hot; ancestor members
						// take the base fill. Either way the row is painted once.
						const hot = isPrimary || parents.has(`${column}\u0000${id}`);
						addSpan(hot ? hotSpansOf : spansOf, column, blockTone, span);
					}
				}
			}
		}

		const mergedSpans = (spans: readonly Span[]): Span[] => {
			const sorted = [...spans].sort((a, b) => a.top - b.top);
			let current: Span | null = null;
			const merged: Span[] = [];
			for (const span of sorted) {
				if (current !== null && span.top <= current.bottom + 1) current.bottom = Math.max(current.bottom, span.bottom);
				else {
					if (current !== null) merged.push(current);
					current = { ...span };
				}
			}
			if (current !== null) merged.push(current);

			return merged;
		};
		// Subtract the hot spans from a base span so a hot row is never painted twice.
		const minusSpans = (span: Span, holes: readonly Span[]): Span[] => {
			let pieces: Span[] = [{ ...span }];
			for (const hole of holes) {
				const next: Span[] = [];
				for (const piece of pieces) {
					if (hole.bottom <= piece.top || hole.top >= piece.bottom) {
						next.push(piece);
						continue;
					}
					if (hole.top > piece.top) next.push({ top: piece.top, bottom: hole.top });
					if (hole.bottom < piece.bottom) next.push({ top: hole.bottom, bottom: piece.bottom });
				}
				pieces = next;
			}

			return pieces;
		};
		const bandPaths = (column: string, spans: readonly Span[], fill: string): SVGElement[] => {
			const box = ribbonColumns.find((entry) => entry.id === column)?.box ?? null;
			if (box === null) return [];

			return mergedSpans(spans).map((span) => {
				const path = document.createElementNS(NS, "path");
				path.setAttribute("d", `M ${box.left} ${span.top} L ${box.right} ${span.top} L ${box.right} ${span.bottom} L ${box.left} ${span.bottom} Z`);
				path.setAttribute("fill", fill);

				return path;
			});
		};
		// The hot spans per column, merged: what the base wash must NOT cover.
		const hotByColumn = new Map<string, Span[]>();
		for (const { column, spans } of hotSpansOf.values()) {
			hotByColumn.set(column, [...(hotByColumn.get(column) ?? []), ...mergedSpans(spans)]);
		}
		const bandChildren: SVGElement[] = [];
		for (const { column, tone, spans } of spansOf.values()) {
			const holes = hotByColumn.get(column) ?? [];
			const base = mergedSpans(spans).flatMap((span) => minusSpans(span, holes));
			bandChildren.push(...bandPaths(column, base, tones[tone]?.fill ?? "transparent"));
		}
		// The hot rows, painted ONCE in the stronger fill (the base was cut away above).
		for (const { column, tone, spans } of hotSpansOf.values()) bandChildren.push(...bandPaths(column, spans, tones[tone]?.hot ?? tones[tone]?.fill ?? "transparent"));

		if (bandLayer.current === null) {
			bandLayer.current = document.createElementNS(NS, "g");
			svg.append(bandLayer.current);
		}
		bandLayer.current.replaceChildren(...bandChildren);

		for (const { index, shape } of placed) {
			alive.add(index);
			let node = laneNodes.current.get(index);
			if (node === undefined) {
				const group = document.createElementNS(NS, "g");
				group.setAttribute("data-index", String(index));
				const caption = document.createElementNS(NS, "text");
				caption.setAttribute("data-caption", shape.id);
				// A caption IS its lane: the same index, so pointing at the words and pointing
				// at the ribbon are the same act — including when the allocator moved the
				// caption down into free space.
				caption.setAttribute("data-index", String(index));
				caption.setAttribute("text-anchor", "middle");
				caption.setAttribute("font-size", "10");
				caption.setAttribute("font-family", theme.mono);
				node = { group, caption };
				laneNodes.current.set(index, node);
				svg.append(group, caption);
			}

		// The RIBBON is the SAME band as the row wash it joins: same colour (`fill`),
		// same height, from the first column to the last. It is filled, never stroked —
		// a thin wire read as "a zero-width line in a strange format", and a brighter
		// slab read as "what is this bright thing?". One calm, continuous band.
		const isHot = hotIndices.has(index);
		const tone = tones[shape.tone];
		// ONE uniform shade, hot or not: the road never changes colour on hover. Hover
		// lights the ROW wash (`hot`) and the caption; the ribbon stays `fill`.
		const fill = tone?.fill ?? theme.ribbon ?? "transparent";
			node.group.setAttribute("data-lane", shape.id);
			node.group.setAttribute("data-hot", isHot ? "true" : "false");
			// A band carries the tone of the ROWS it covers: one row of a lane that breaks
			// the correspondence is painted as such instead of being swallowed by the lane's
			// own wash. The BANDS themselves are painted once, in the wash layer above; a lane
			// here owns its ribbons, its caption and its hover.
			const children: SVGElement[] = [];
			for (const ribbon of shape.ribbons) {
				// The visible band: filled in the row wash colour, one continuous shape.
				const path = document.createElementNS(NS, "path");
				path.setAttribute("d", ribbon.path);
				path.setAttribute("fill", fill);
				path.setAttribute("stroke", "none");
				children.push(path);
			}
			// REPLACED, not appended: a lane owns one fixed set of nodes, so a board that
			// has been scrolled for an hour owns exactly as many paths as it did at first.
			node.group.replaceChildren(...children);

			const caption = node.caption;
			if (shape.caption !== null && shape.label !== null) {
				caption.setAttribute("x", String(shape.caption.x));
				caption.setAttribute("y", String(shape.caption.y));
				caption.setAttribute("fill", isHot ? theme.text : theme.dim);
				caption.setAttribute("data-hot", isHot ? "true" : "false");
				caption.textContent = shape.label;
			} else {
				caption.textContent = "";
			}
		}

		for (const [index, node] of laneNodes.current) {
			if (alive.has(index)) continue;
			node.group.remove();
			node.caption.remove();
			laneNodes.current.delete(index);
		}
	};

	paintRef.current = paint;
	// Every render ends with a paint: the nodes already exist, geometry is the only
	// thing that may have moved (hover, pick, expand, a new layout).
	useLayoutEffect(() => {
		paint();
	});

	// THE BOARD IS AS TALL AS THE CODE. The height is measured by the row plates, never
	// by a lane: a lane that would go deeper is clipped by the frame and the columns
	// keep their own scroll, so nothing drags the page down and no content is invented
	// below the last row.
	const sized = 0;

	// Pointer moves arrive faster than the screen refreshes; coalesce them into ONE
	// state update per animation frame so a fast sweep does not re-render the board a
	// hundred times a second. The latest event wins.
	const applyPointer = (): void => {
		const pending = pendingPointer.current;
		if (pending === null) return;
		const { target, x, y } = pending;
		if (target.closest("svg") !== null) return;
		// ENTERING A ROW ENDS THE LANE. A lane is cleared by `pointerleave` of the layer,
		// and that never fires when the pointer jumps from a ribbon straight onto a row
		// above it — so the lane named a moment ago stayed hot and every row hover was
		// answered by that old lane. One answer at a time.
		const cell = target.closest("[data-column]");
		if (!(cell instanceof HTMLElement)) {
			setLaneHover(null);
			setHover(null);

			return;
		}
		const column = cell.dataset.column ?? "";
		// A renderer marks its row with `data-item` when it has one; otherwise the
		// anchor IS the id.
		const row = target.closest("[data-item]");
		const anchor = target.closest("[data-anchor]");
		const id =
			row instanceof HTMLElement && row.dataset.item !== undefined
				? row.dataset.item
				: anchor instanceof HTMLElement && anchor.dataset.anchor !== undefined
					? idsByAnchor.get(`${column}\u0000${anchor.dataset.anchor}`)
					: undefined;
		const char = charAt(anchor instanceof HTMLElement ? anchor : null, x, y);
		const next = id === undefined ? null : char === undefined ? { column, item: id } : { column, item: id, char };
		setLaneHover(null);
		// Report the row hover out (in addition to the built-in lane highlight), only when
		// the ROW changes — not on every character move within it. Done here, outside the
		// state updater, so it is never a side effect during render.
		const prev = hoverRef.current;
		if (prev?.column !== next?.column || prev?.item !== next?.item) {
			controller?.onRowHover?.(next === null ? null : { column: next.column, item: next.item });
		}
		hoverRef.current = next;
		setHover((current) => (current?.column === next?.column && current?.item === next?.item && current?.char === next?.char ? current : next));
	};
	const onPointerOver = (event: ReactPointerEvent<HTMLDivElement>): void => {
		pendingPointer.current = { target: event.target as HTMLElement, x: event.clientX, y: event.clientY };
		// Coalesce a fast sweep into at most one update per frame (~16ms). Time-based,
		// not rAF-based, so a hover always lands even in a background tab where rAF is
		// throttled or never fires. The first event of a burst applies immediately.
		const now = typeof performance !== "undefined" ? performance.now() : Date.now();
		if (now - lastPointerApply.current < 16) return;
		lastPointerApply.current = now;
		applyPointer();
	};

	// A pick keeps exactly what the pointer showed. Clicking the same row again (or
	// the fold button) lets everything back. The view reports the change out; when a
	// controller owns `picked`, it drives the state back through the prop.
	// REVEAL IS REPORTED, not private. The owner's "only blocks / show all" chip and the
	// board's fold button are the SAME state: every internal change is pushed out through
	// `onReveal(next)` so the chip never disagrees with what the board shows.
	const changeRevealed = (next: boolean): void => {
		setRevealed(next);
		controller?.onReveal?.(next);
	};

	const pick = (next: { column: string; item: string }): void => {
		if (chainOf(next).size === 0) return;
		const cleared = picked?.column === next.column && picked?.item === next.item;
		const value = cleared ? null : next;
		changeRevealed(false);
		setPicked(value);
		controller?.onPick?.(value);
	};

	// Toggle a row in the selection and report the new set out. Selection is the
	// controller's state; the view only draws the mark and reports the toggle.
	const toggleSelect = (ref: { column: string; item: string }): void => {
		const key = `${ref.column}\u0000${ref.item}`;
		const next = selectedSet.has(key) ? selected.filter((entry) => `${entry.column}\u0000${entry.item}` !== key) : [...selected, ref];
		controller?.onSelect?.(next);
	};

	const onClick = (event: ReactPointerEvent<HTMLDivElement>): void => {
		const target = event.target as HTMLElement;
		if (target.closest("svg") !== null) return;
		// An action button (gutter or toolbar) is handled by its own onClick; the board
		// must not also read it as a row click.
		if (target.closest("[data-action]") !== null) return;
		const cell = target.closest("[data-column]");
		const stamp = cell instanceof HTMLElement ? cell.dataset.column : undefined;
		if (stamp === undefined) return;
		const row = target.closest("[data-item]");
		if (row instanceof HTMLElement && row.dataset.item !== undefined) {
			const ref = { column: stamp, item: row.dataset.item };
			// A controller's onRowClick REPLACES the built-in filter: the owner decides
			// what a click means (select, stage, open, …). Omit it to keep click-to-filter.
			if (controller?.onRowClick !== undefined) {
				controller.onRowClick(ref);

				return;
			}
			pick(ref);
		}
	};

	// A LANE's own handlers, delegated on the layer. The pointer names a LANE (its index),
	// and a lane's caption carries the SAME index — so pointing at words that the allocator
	// moved down still points at the lane they name.
	const laneIndexOf = (element: Element): number | null => {
		const lane = element.closest("[data-index]");
		if (lane === null) return null;
		const index = Number(lane.getAttribute("data-index"));

		return Number.isFinite(index) && shown[index] !== undefined ? index : null;
	};

	const onLayerOver = (event: ReactPointerEvent<SVGSVGElement>): void => {
		const index = laneIndexOf(event.target as Element);
		if (index === null) return;
		// A lane is ONE thing: the row under the pointer and its correspondence are the same
		// subject, so the highlight goes through the lane, not through a chain of rows.
		setHover(null);
		setLaneHover(index);
	};

	const onLayerLeave = (): void => {
		setLaneHover(null);
		setHover(null);
	};

	const onClickLayer = (event: ReactPointerEvent<SVGSVGElement>): void => {
		const index = laneIndexOf(event.target as Element);
		if (index === null) return;
		const connection = shown[index];
		if (connection === undefined) return;
		event.stopPropagation();
		// The whole connection is the subject of a ribbon click; the controller decides
		// what to do with it (apply a hunk, open a pair, …). The view also focuses it.
		controller?.onConnectionClick?.(connection);
		const end = connection.ends.find((entry) => entry.items.length > 0);
		if (end !== undefined) pick({ column: end.column, item: String(end.items[0]) });
	};

	// An action button was clicked (gutter or toolbar). The view reports the action,
	// its target row (or null for a toolbar action), and the current selection; the
	// controller performs it. The view never decides what an action means.
	const runAction = (action: BoardAction, ref: RowRef | null): void => {
		action.onAction(ref, selected);
	};
	const toolbarActions = (controller?.actions ?? []).filter((action) => action.scope === "toolbar");

	return (
		<ThemeProvider theme={theme}>
			{toolbarActions.length === 0 ? null : (
				<Toolbar>
					{toolbarActions.map((action) => (
						<ToolbarButton
							key={action.id}
							type="button"
							data-action={action.id}
							title={action.label}
							disabled={action.disabled?.(null) === true}
							onClick={() => runAction(action, null)}
						>
							{action.icon}
							<span>{action.label}</span>
						</ToolbarButton>
					))}
					{selected.length > 0 ? <ToolbarCount>{selected.length} selected</ToolbarCount> : null}
				</Toolbar>
			)}
			<Frame
				ref={root}
				style={sized > 0 ? { minHeight: `${Math.ceil(sized)}px` } : undefined}
				$template={templateOf(columns, corridors, fit)}
				$height={config.boardHeight}
				onPointerOver={onPointerOver}
				// The CHARACTER under the pointer moves with the pointer, and `pointerover` fires
				// only when the row is entered: without this the piece would be the one the
				// pointer entered on, not the one it is on.
				onPointerMove={onPointerOver}
				onPointerLeave={() => {
					setHover(null);
					setLaneHover(null);
				}}
				onClick={onClick}
			>
				{columns.map((column, index) => {
					const Render = renderers[column.kind] as Renderer<Data> | undefined;
					if (!Render) throw new Error(`code-diff: no renderer for kind "${column.kind}"`);
					const corridor = corridors[index];
					const linkSet = connected.get(column.id);
					// Folding is the comparison default; a column may opt out (`fold: false`),
					// and the board may turn it off for everyone (`options.foldUnconnected`).
					const foldHere = column.fold ?? config.foldUnconnected;

					return (
						<Group key={column.id}>
							<Cell data-column={column.id} $cap={column.cap === true} $bounded={config.boardHeight !== undefined}>
								<Render
									column={column}
									{...(render === undefined ? {} : { render })}
									{...(onAction === undefined ? {} : { onAction })}
									{...(linkSet === undefined || foldHere === false ? {} : { connected: linkSet })}
									expanded={revealedNow}
									onLayout={measure}
									{...(highlights.has(column.id) ? { highlight: highlights.get(column.id) } : {})}
									onReveal={() => {
										setPicked(null);
									changeRevealed(true);
									controller?.onPick?.(null);
									}}
									{...(fit === undefined ? {} : { fit })}
									{...(tokenize === undefined ? {} : { tokenize })}
									tones={tones}
									options={config}
									{...(controller?.selected === undefined ? {} : { selected: new Set(selected.filter((ref) => ref.column === column.id).map((ref) => ref.item)) })}
									{...(controller?.onSelect === undefined ? {} : { onToggleSelect: (id: string) => toggleSelect({ column: column.id, item: id }) })}
									{...(controller?.actions === undefined ? {} : { actions: controller.actions })}
									onRowAction={(action, id) => runAction(action, { column: column.id, item: id })}
								/>
							</Cell>
							{corridor === undefined ? null : <Corridor data-corridor={index} />}
						</Group>
					);
				})}

				{/* THE LAYER IS EMPTY BY CONSTRUCTION: `paint()` writes the lanes into it, so an
				    hour of scrolling cannot add a single node to the board. */}
				<Layer ref={layer} onPointerOver={onLayerOver} onPointerLeave={onLayerLeave} onClick={onClickLayer} />
			</Frame>
		</ThemeProvider>
	);
};

export type { Theme };
export default Surface;
