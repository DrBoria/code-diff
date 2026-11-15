/**
 * ── ROW ────────────────────────────────────────────────────────────────────
 *
 * A Row is one line of a column: a number plate, text, painted ranges, an
 * explanation, and optional grouping. There is no separate "block" or "fold"
 * entity — a row is flexible enough to be a group header, a group member, or a
 * folded run, and show/hide are ordinary row actions.
 */

/** Anything addressable by id. */
export type RowId = string | number;

/** A reference to one row: the view's only address. */
export interface RowRef {
	readonly column: string;
	readonly row: RowId;
}

/** One lexical token of a line: its text and the colour it is written in. */
export interface Token {
	readonly text: string;
	readonly ink?: string;
}

/** A piece of a row's text that may be highlighted on its own. */
export interface RowTextSpan {
	readonly text: string;
	/** Paint it as a shared/duplicate range. */
	readonly paint?: boolean;
	/** Painted as the FOCUSED occurrence of a ribbon under the pointer. */
	readonly strong?: boolean;
	readonly ink?: string;
}

/** A character range inside a row's text that must be painted. */
export interface TextRangeHighlight {
	readonly from: number;
	readonly to: number;
	readonly ink?: string;
	/** Painted as the focused occurrence, not a standing mark. */
	readonly strong?: boolean;
}

/** A bare counter pinned above a character position of a row. */
export interface Counter {
	/** Character offset in the row's text the counter stands over. */
	readonly from: number;
	readonly text: string;
	readonly title?: string;
}

/** The explanation of what changed, drawn under the code line. */
export interface ExplanationNote {
	readonly text: string;
	/** Semantic colour key the explanation is written in; absent = the row's tone. */
	readonly tone?: string;
}

/** One row of a column. */
export interface Row {
	readonly id: RowId;
	/** Semantic colour key of this row (duplicate / unique / added / …). */
	readonly tone?: string;
	/** The number plate; undefined = no plate. */
	readonly plate?: string;
	/** Plain text; the board tokenizes and marks it. */
	readonly text?: string;
	/** Explicit spans, when the owner takes full control of the text. */
	readonly spans?: readonly RowTextSpan[];
	/** Standing character ranges to paint. */
	readonly marks?: readonly TextRangeHighlight[];
	/** Counters pinned above the row. */
	readonly counters?: readonly Counter[];
	/** Explanation drawn under the code line. */
	readonly explanation?: ExplanationNote;
	/** Indent level inside its group (0 = header). */
	readonly indent?: number;
	/** Group this row belongs to; a column lights the whole group on hover. */
	readonly group?: string;
	/** True when this row is the header of its group (drawn emphasised). */
	readonly groupHeader?: boolean;
	/** When set, this row is a folded run hiding this many rows. */
	readonly hiddenCount?: number;
	/** The ids this folded run hides (so a ribbon can route to it). */
	readonly hiddenIds?: readonly RowId[];
	/** Opaque owner data. */
	readonly data?: unknown;
}

/** The DOM box a row occupies, in content coordinates. */
export interface Box {
	readonly top: number;
	readonly bottom: number;
	readonly left: number;
	readonly right: number;
}
