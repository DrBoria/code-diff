import type { Box, RowId } from "../rows/row-types.js";

/**
 * ── RIBBON ─────────────────────────────────────────────────────────────────
 *
 * A Ribbon is ONE logical entity: a chain that ties rows across columns. It is
 * indivisible — hovering any piece (a word, a row, a connector, a caption) lights
 * the WHOLE chain at ONE uniform intensity. Its ends and text anchors are fields
 * of the Ribbon itself, not separate public entities.
 */

/** Where a ribbon's correspondence is written inside a row's text. */
export interface RibbonTextAnchor {
	readonly column: string;
	readonly line: string;
	readonly from: number;
	readonly to: number;
	readonly ink?: string;
	/** The duplicate of this exact range on the other side. */
	readonly duplicate?: { column: string; line: string; from: number; to: number; ink?: string };
}

/** One end of a ribbon: a column and the row ids it ties there. */
export interface RibbonEnd {
	readonly column: string;
	readonly rows: readonly RowId[];
	/**
	 * A gap endpoint marks ABSENCE between two rows (a deletion in git): the
	 * ribbon points between `after` and the next row, never into empty space.
	 */
	readonly gap?: { after: RowId };
}

/** A ribbon the owner decided on. */
export interface Ribbon {
	readonly id: string;
	/** Semantic colour key (duplicate / unique / changed / …). */
	readonly tone?: string;
	readonly label?: string;
	readonly ends: readonly RibbonEnd[];
	/** The exact text ranges this ribbon is about, per end. */
	readonly anchors?: readonly RibbonTextAnchor[];
}

/** The connector piece between two neighbouring columns of a ribbon. */
export interface RibbonConnector {
	readonly from: string;
	readonly to: string;
	readonly path: string;
	readonly height: number;
	/** Centre of the connector, where action icons sit. */
	readonly cx: number;
	readonly cy: number;
}

/** A measured ribbon: the ribbon's own identity (id/tone/label) plus what
 *  measuring adds — bands per column, connectors, caption, corridor box. */
export interface MeasuredRibbon extends Pick<Ribbon, "id"> {
	readonly tone: string;
	readonly label: string | null;
	readonly bands: readonly { column: string; rows: readonly RowId[]; top: number; bottom: number; tone?: string }[];
	readonly connectors: readonly RibbonConnector[];
	readonly caption: { x: number; y: number } | null;
	readonly box: Box | null;
}
