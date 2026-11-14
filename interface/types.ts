import type { ReactNode } from "react";

/**
 * code-diff · the interface
 *
 * The contract. Nothing here knows what a column shows or why two anchors belong
 * together. Everything is built from a handful of small traits, and every larger
 * type EXTENDS them — so a field is declared once and named the same everywhere.
 */

/** Anything that can be drawn as one entry of a column. */
export type ItemId = string | number;

/** The DOM box a link attaches to. Defaults to the item's own box. */
export type AnchorId = string;

// ── TRAITS ──────────────────────────────────────────────────────────────────
// The pieces every other interface is assembled from. One name per idea: `id` is
// always `id`, an arrow is always `from`/`to`, a colour key is always `tone`.

export interface Identified {
	readonly id: ItemId;
}

export interface Named {
	readonly label: string;
}

export interface Toned {
	readonly tone: string;
}

export interface Anchored {
	/** Where a link attaches. Defaults to `item:<id>`. */
	readonly anchor?: AnchorId;
}

export interface Placed {
	readonly x: number;
	readonly y: number;
}

/** Anything that points from one end to another. Both arrows extend this. */
export interface Directed<End> {
	readonly from: End;
	readonly to: End;
}

/** Anything measured on screen: the box IS the geometry, no field list twice. */
export interface Box {
	readonly top: number;
	readonly bottom: number;
	readonly left: number;
	readonly right: number;
}

// ── CONTENT ─────────────────────────────────────────────────────────────────

/** A piece of a row that may be highlighted on its own (a word, a token). */
export interface Segment {
	readonly text: string;
	/** Paint it as "the same on both sides" — a tone key `paint` decides colour. */
	readonly paint?: boolean;
	/** Painted as the FOCUSED occurrence of a lane under the pointer. */
	readonly strong?: boolean;
	/** The colour this piece is written in: the owner's token palette, not ours. */
	readonly ink?: string;
}

/** One lexical token of a line: its text, and the colour it is written in. */
export interface Token {
	readonly text: string;
	readonly ink?: string;
}

/** A character range inside an item's `text` that must be painted (a shared name). */
export interface Mark {
	readonly from: number;
	readonly to: number;
	readonly ink?: string;
	/** Painted as the FOCUSED occurrence (a lane under the pointer), not as a standing mark. */
	readonly strong?: boolean;
}

/**
 * A bare number pinned ABOVE a character position of a row: a RELATIVE position,
 * not a column of its own. `from` is an offset in the row's text, so the number
 * stands over the place it counts — the argument list of a call, the start of a
 * step — and sticks out above the line.
 */
export interface Note {
	readonly from: number;
	readonly text: string;
	/** Hover text: what the number counts. */
	readonly title?: string;
}

/** A row the owner folded away: drawn as a button that asks to be opened. */
export interface Collapsed {
	readonly text: string;
}

/** One entry of a column: a line, a node, a card. `data` is opaque. */
export interface Item<Data = never> extends Identified, Anchored {
	readonly data?: Data;
	/**
	 * The tone of THIS row, when it differs from its lane's (`differs` on a row that
	 * breaks the correspondence). Optional: absent means "whatever the lane says".
	 */
	readonly tone?: string;
	/** The line/number plate of this row; `undefined` = no plate. */
	readonly plate?: string;
	/** The row's pieces, when it must be highlighted inside. */
	readonly segments?: readonly Segment[];
	/** Plain text of the row; the package tokenizes and marks it itself. */
	readonly text?: string;
	/** Character ranges inside `text` to paint with the `paint` colour. */
	readonly marks?: readonly Mark[];
	/** Bare numbers pinned above this row at a character offset. */
	readonly notes?: readonly Note[];
	/**
	 * The CODE LINE this row STANDS FOR, when it is not the row itself — a tree row names
	 * a construct that is written on a code line. A pointer on the row means that line.
	 */
	readonly line?: string;
	/** Present when this item stands for a folded run of rows. */
	readonly collapsed?: Collapsed;
}

/** A reference to a node: inside this column, or inside another one. */
export interface NodeRef {
	readonly column?: string;
	readonly node: ItemId;
}

/** An arc of a graph. Ends may leave the column, which is what a link is. */
export interface Arc extends Directed<NodeRef | ItemId> {
	readonly tone?: string;
	readonly label?: string;
}

/** How a column's content is rendered. A new kind is a new renderer. */
export type ColumnKind = "items" | "graph" | (string & {});

/**
 * Columns that scroll TOGETHER. The whole rule is explicit: a group lists
 * exactly the column ids that move as one, so 1&4 or 1,3,5 are different groups
 * — no per-column flags. `axis` is only which directions move together.
 */
export interface SyncGroup {
	readonly columns: readonly string[];
	readonly axis?: "x" | "y" | "xy";
}

export interface Column<Data = never> {
	readonly id: string;
	readonly kind: ColumnKind;
	readonly title?: string;
	readonly items?: readonly Item<Data>[];
	readonly arcs?: readonly Arc[];
	/** Preferred width in pixels; omitted means "share the remaining space". */
	readonly width?: number;
	/**
	 * Share of the free space, in `fr` — `2` makes this column twice as wide as a `1`.
	 * Takes precedence over `width`, so a board can be laid out as `2fr 1fr 1fr 1fr 2fr`.
	 */
	readonly ratio?: number;
	/** A hint for a renderer that mirrors itself; geometry never uses it. */
	readonly mirrored?: boolean;
	/**
	 * Do not let this column's height decide the board's: it is capped to the height
	 * the other columns make and scrolls inside it. A tree next to its code is the
	 * case — the board ends where the code ends, not where the longest tree ends.
	 */
	readonly cap?: boolean;
	/**
	 * `false` keeps EVERY row this column carries: nothing is folded away, so the rows
	 * stay in step with the columns beside it and the column scrolls instead.
	 */
	readonly fold?: boolean;
}

// ── CONNECTIONS ─────────────────────────────────────────────────────────────

/**
 * One end of a connection: a column id and the IDS of the items it joins there.
 * This is how an owner says "these three rows in column A are the same thing as
 * those sixteen rows in column C" — with ids, not coordinates, and with the
 * arity the data has rather than a pair per combination.
 */
export interface ConnectionEnd {
	readonly column: string;
	readonly items: readonly ItemId[];
}

/**
 * A ribbon the owner decided on: `id` is the connectionId, `ends` are the row
 * ids it ties together, one end per column. The board measures the ids it knows
 * and draws the ribbon; how the owner grouped the rows is not its business.
 */
export interface Connection {
	readonly id: string;
	readonly tone?: string;
	readonly label?: string;
	readonly ends: readonly ConnectionEnd[];
	/**
	 * WHERE the correspondence is written: the character range of each end inside its
	 * row. A lane that names a row but not a range can only wash the row; with the range
	 * the board underlines the exact occurrence — on hover in any column.
	 */
	readonly marks?: readonly LaneMark[];
}

/** One end's character range: a row in a column, and the offsets inside its text. */
export interface LaneMark {
	readonly column: string;
	readonly line: string;
	readonly from: number;
	readonly to: number;
	/**
	 * THE DUPLICATE of this very range: where the same name is written on the other side.
	 * A lane joins rows, but a reader points at a WORD — and the answer to "what is this
	 * duplicated with?" is one range over there, not the row it happens to sit in.
	 */
	readonly twin?: { readonly column: string; readonly line: string; readonly from: number; readonly to: number };
}

/** A colour key the owner supplied. The package never derives a colour. */
export interface Tone {
	readonly fill: string;
	readonly line?: string;
	/**
	 * The fill of THE ONE lane under the pointer, painted on top of `fill`. A wash
	 * that is identical on every row says nothing; the pointed-at lane is the only
	 * row that has to be darker than its neighbours.
	 */
	readonly hot?: string;
}

export type Tones = Readonly<Record<string, Tone>>;

/** One band: the wash behind a contiguous run of an end's rows, in its column. */
export interface LaneBand {
	readonly column: string;
	readonly path: string;
	/** The measured span of the band inside its column: what overlapping bands are merged by. */
	readonly top: number;
	readonly bottom: number;
	/**
	 * The tone of the ROWS this band covers, when the run is not uniform: a lane one
	 * row of which breaks the correspondence paints that row `differs`.
	 */
	readonly tone?: string;
}

/** One ribbon: the bezier band that joins two neighbouring columns of a lane. */
export interface LaneRibbon {
	readonly from: string;
	readonly to: string;
	readonly path: string;
}

/** What one lane looks like once its ends are measured. Pure data. */
export interface LaneShape extends Toned {
	readonly id: string;
	readonly label: string | null;
	/** The wash behind the rows of each end, in column order. */
	readonly bands: readonly LaneBand[];
	/** The bezier ribbons between neighbouring ends. */
	readonly ribbons: readonly LaneRibbon[];
	/**
	 * The box the lane's ribbon occupies in its first corridor. Two lanes whose rows
	 * coincide produce the same ribbon in the same place — the board uses this box to
	 * move one of them into free space instead of drawing them on top of each other.
	 */
	readonly ribbon: Box | null;
	/** Where to print the label, above the lane; null when it has no room. */
	readonly caption: Placed | null;
	/**
	 * The plateau is the WHOLE overlap of the two ends: the lane is one solid block
	 * across the corridor. Such a lane covers the very rows it names, so there is no
	 * free space to dip it into — it is drawn where it belongs and the other lanes
	 * step around it.
	 */
	readonly solid?: boolean;
}

export interface Measured {
	readonly box: Box;
	readonly anchors: ReadonlyMap<string, Box>;
	/** The measured box of each COLUMN, keyed by column id. */
	readonly columns: ReadonlyMap<string, Box>;
}

// ── PLUGINS ─────────────────────────────────────────────────────────────────
//
// Nothing is hard-wired, and both levels arrive through props: a default that
// cannot be replaced is a default that decides for the user.
//
//   1. ITEM RENDERER — how ONE item is drawn. Pass your own for your own
//      language, highlighter or typography; it may return any React node.
//   2. COLUMN RENDERER — how a WHOLE column of a `kind` is drawn. This is how a
//      new kind appears (`graph`, `cards`, `timeline`) without touching the
//      package: `renderers={{ graph: MyGraph }}`.
//
// Rules both must follow, because the geometry depends on them:
//   - the linked element carries `data-anchor="<anchor>"`;
//   - the anchor sits INSIDE the element carrying `data-column`;
//   - an anchor may appear many times in a column — boxes are unioned, so an item
//     drawn as several rows is still one end;
//   - a renderer must not position itself absolutely over other columns.

/** What an item renderer is given. */
export interface ItemRenderArgs<Data = never> {
	readonly item: Item<Data>;
	readonly column: Column<Data>;
	/** Position inside the column, for alternating tones. */
	readonly index: number;
	/** True when this column is drawn on the right of the view. */
	readonly mirrored: boolean;
}

/** How one item is drawn. The default prints `String(item.data ?? item.id)`. */
export type ItemRender<Data = never> = (args: ItemRenderArgs<Data>) => ReactNode;

/**
 * How the board fits a narrow screen.
 *   `scroll` keeps every width and lets a pane scroll sideways;
 *   `rubber` lets the corridors shrink and clips each line, keeping its
 *            beginning, so nothing scrolls horizontally.
 */
export type Fit = "scroll" | "rubber";

/** A renderer receives only its own column and the item plugin. */
export interface RendererProps<Data = never> {
	readonly column: Column<Data>;
	/** The item plugin in force; a renderer only forwards it. */
	readonly render?: ItemRender<Data> | undefined;
	/** Called when the reader acts on an item (opens a folded run, clicks a row). */
	readonly onAction?: (item: Item<Data>) => void;
	/**
	 * Ids of this column's items that take part in at least one connection. The
	 * renderer hides everything else by default — that decision belongs to the
	 * board, never to whoever produced the data.
	 */
	readonly connected?: ReadonlySet<string>;
	/** True once the reader asked to reveal hidden rows (board-wide, all columns). */
	readonly expanded?: boolean;
	/** Ask the board to reveal hidden rows in EVERY column at once. */
	readonly onReveal?: () => void;
	/**
	 * The set of anchors this column has MOUNTED has changed (virtual scroll moved
	 * its window, or the column was resized). The geometry is measured from mounted
	 * anchors only, so the board re-measures then — never on a plain scroll.
	 */
	readonly onLayout?: (() => void) | undefined;
	/** How the board fits a narrow screen; forwarded from the view. */
	readonly fit?: Fit;
	/** Turns a row's text into coloured tokens; the package cuts it by `marks`. */
	readonly tokenize?: (text: string, column: string) => readonly Token[];
	/**
	 * Ranges of THIS column the pointer focuses: the occurrence a lane stands for.
	 * Keyed by row id, so a renderer only merges them where they belong — it never
	 * searches the text and never decides which range matters.
	 */
	readonly highlight?: ReadonlyMap<string, readonly Mark[]> | undefined;
	/** The resolved display knobs (row height, virtual-scroll thresholds, …). */
	readonly options?: import("../config.js").ResolvedOptions;
}

/** One renderer per column `kind`. Any kind may be replaced by the caller. */
export type Renderer<Data = never> = (props: RendererProps<Data>) => ReactNode;

export type Renderers = Readonly<Record<ColumnKind, Renderer<never>>>;

/** Everything the view paints with. There are no colours inside the package. */
export interface Theme {
	readonly paper: string;
	readonly panel: string;
	readonly edge: string;
	readonly text: string;
	readonly dim: string;
	readonly faint: string;
	readonly mono: string;
	/** Colour of a `Segment.paint`ed piece. */
	readonly paint?: string;
	/** Stroke of the ribbons between columns. Defaults to the tone colour. */
	readonly ribbon?: string;
	/**
	 * A text-shadow underlay painted behind glyphs so they read on a wash. The
	 * default is a dark backdrop (for dark code surfaces); a light theme supplies
	 * its own (or "none"). Keeps the package free of a baked-in dark assumption.
	 */
	readonly shadow?: string;
}

export interface ViewProps<Data = never> {
	readonly columns: readonly Column<Data>[];
	readonly connections?: readonly Connection[];
	/** Corridor width in pixels after each column; `undefined` = no corridor. */
	readonly corridors?: readonly (number | undefined)[];
	/**
	 * How the board fits a narrow screen. Default `"scroll"`: widths are fixed and
	 * a pane scrolls sideways. `"rubber"`: corridors shrink to fit and every line
	 * is clipped from its end, so its beginning is always visible.
	 */
	readonly fit?: Fit;
	/** Explicit groups of columns that scroll together; any subsets. */
	readonly sync?: readonly SyncGroup[];
	/**
	 * Start with every row revealed. The board still lets the reader hide them
	 * again; this is only the initial state the owner asked for.
	 */
	readonly reveal?: boolean;
	readonly tones?: Tones;
	readonly theme: Theme;
	readonly renderers?: Partial<Renderers> | undefined;
	/** The item plugin given to EVERY renderer — your own code rendering. */
	readonly render?: ItemRender<Data> | undefined;
	/** Turns a row's text into coloured tokens; the package cuts it by `marks`. */
	readonly tokenize?: (text: string, column: string) => readonly Token[];
	/** Called when the reader acts on an item; forwarded to every renderer. */
	readonly onAction?: (item: Item<Data>) => void;
	/**
	 * Display knobs the owner may override. Every field has a sensible default
	 * inside the package, so omitting `options` keeps the standard look — but the
	 * system is not closed: row height, the band gap, the diff limits and the
	 * virtual-scroll thresholds are all the owner's to set.
	 */
	readonly options?: BoardOptions;
	/**
	 * The external controller: row/connection click callbacks and controlled focus.
	 * code-diff performs no merge or dataset mutation itself — it reports interactions
	 * here and a controller drives it back. Omit for the built-in comparison behaviour.
	 */
	readonly controller?: BoardController;
}

/**
 * The configurable display parameters of the board. None is required: each falls
 * back to the package default. They are gathered here so an owner tunes the view
 * in one place instead of the values being buried as constants in the engine.
 */
export interface BoardOptions {
	/** Height of one row in pixels (the list is uniform). Default 18. */
	readonly rowHeight?: number;
	/** Hairline gap above/below a band so neighbouring lanes never touch. Default 1. */
	readonly bandGap?: number;
	/** Equal lines kept at each end of a folded run. Default 3. */
	readonly diffContext?: number;
	/** Above this many tokens a changed line is not word-diffed. Default 400. */
	readonly maxWordTokens?: number;
	/** Lists up to this many rows are mounted whole (no windowing). Default 400. */
	readonly fullMount?: number;
	/** Viewports kept mounted above and below the visible window. Default 1. */
	readonly overscan?: number;
	/** An id in this many lanes is a hub; a hover does not walk through it. Default 3. */
	readonly hubLanes?: number;
	/** Max height of an uncapped pane (a CSS length). Default "74vh". */
	readonly maxHeight?: string;
	/**
	 * Whether columns hide rows that take part in no connection (folding them into
	 * "N hidden — click to show"). Default true (the comparison view). A git/merge
	 * owner that shows every row sets this false board-wide, instead of per column.
	 */
	readonly foldUnconnected?: boolean;
	/**
	 * The label of a folded run, given the hidden count. Default mentions "lines";
	 * a tree or graph column supplies its own ("N nodes hidden", …).
	 */
	readonly foldLabel?: (count: number) => string;
}

/** A reference to one row: a column id and an item id — the view's only address. */
export interface RowRef {
	readonly column: string;
	readonly item: string;
}

/**
 * The controller contract. code-diff is VIEW ONLY: it never decides a merge or
 * mutates the dataset. Every interaction is reported out through these callbacks,
 * and an external controller may drive the view back through the controlled props
 * (`picked`, `reveal`). Omit them all and the view keeps its own built-in
 * pick/reveal behaviour (the standalone comparison default).
 */
export interface BoardController {
	/** A row was clicked (any column). The controller decides what it means. */
	readonly onRowClick?: (ref: RowRef) => void;
	/** A ribbon or its caption was clicked: the whole connection is the subject. */
	readonly onConnectionClick?: (connection: Connection) => void;
	/** The view's focused chain changed (null = cleared). For a controlled `picked`. */
	readonly onPick?: (ref: RowRef | null) => void;
	/** The reader asked to reveal hidden rows board-wide. */
	readonly onReveal?: () => void;
	/** Controlled focus: when set, the view shows exactly this chain. */
	readonly picked?: RowRef | null;
}
