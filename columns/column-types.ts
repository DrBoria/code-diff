import type { Box, Row, RowId } from "../rows/row-types.js";

/**
 * ── COLUMN ─────────────────────────────────────────────────────────────────
 *
 * A Column is a named list of Rows with a width and a scroll behaviour. It owns
 * group highlighting (light every row of a hovered row's group) and sync scroll.
 */

export interface Column {
	readonly id: string;
	readonly title?: string;
	readonly rows?: readonly Row[];
	/** Preferred width in pixels; omitted = share the free space. */
	readonly width?: number;
	/** Share of free space in `fr`; takes precedence over width. */
	readonly ratio?: number;
	/** Mirror the number plate to the outer edge (right-hand columns). */
	readonly mirrored?: boolean;
	/** Cap this column's height to the board's; it scrolls inside. */
	readonly cap?: boolean;
	/** false keeps every row (nothing folded). Default follows config. */
	readonly fold?: boolean;
	/** Source path, for the owner's tokenizer. */
	readonly path?: string;
}

/** Columns that scroll together: an explicit list of ids + which axes. */
export interface SyncGroup {
	readonly columns: readonly string[];
	readonly axis?: "x" | "y" | "xy";
}

/** How the board fits a narrow screen. */
export type Fit = "scroll" | "rubber";

/** A measured layout: column boxes + row anchor boxes in content coordinates. */
export interface Layout {
	readonly columns: ReadonlyMap<string, Box>;
	readonly anchors: ReadonlyMap<string, Box>;
}

/** The set of row ids per column that take part in at least one ribbon. */
export type ConnectedMap = ReadonlyMap<string, ReadonlySet<RowId>>;
