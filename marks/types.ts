// ── MARK RESOLUTION · the contract between model and view ──────────────────
//
// The MODEL says WHAT corresponds: a name on the left is the same member as a
// name on the right, under a connectionId, with a tone. It never computes a
// character range — that is display work.
//
// The VIEW (this module) says WHERE: it locates each name in the rows the board
// already has, turns it into a `LaneMark` (from/to), and pairs each mark with its
// twin on the other side so a hover lights the exact duplicate.

import type { Connection, LaneMark } from "../interface/types.js";

/** One row the board carries, as far as mark resolution needs it: a cell per column. */
export interface MarkRow {
	readonly type: string;
	/** One cell per column; `null` where the column has no line here. */
	readonly cells: readonly (MarkCell | null)[];
	/** A folded run carries the hidden rows themselves. */
	readonly rows?: readonly MarkRow[];
}

export interface MarkCell {
	/** The row id (its line number, as a string). */
	readonly no: number | string;
	readonly text?: string;
	readonly words?: readonly { readonly text: string }[];
}

/**
 * A SEMANTIC correspondence the model decided: the member `left` in column
 * `leftColumn` is the same thing as `right` in `rightColumn`. `name` is what to
 * locate in the row text; `key` (optional) disambiguates two members that share a
 * name (a property's value, a method's signature) so twins pair by identity first.
 */
export interface MemberLink {
	readonly connectionId: string;
	readonly label?: string;
	readonly tone?: string;
	readonly leftColumn: string;
	readonly rightColumn: string;
	readonly left: { readonly name: string; readonly key?: string };
	readonly right: { readonly name: string; readonly key?: string };
}

/** A resolved lane: a Connection plus the marks (with twins) the view computed. */
export interface ResolvedLane extends Connection {
	readonly marks: readonly LaneMark[];
}