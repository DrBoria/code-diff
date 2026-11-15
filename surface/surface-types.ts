import type { Box } from "../rows/row-types.js";

/**
 * ── SURFACE ────────────────────────────────────────────────────────────────
 *
 * The Surface is ONLY the backdrop: it measures real DOM boxes (rows + columns)
 * in content coordinates and exposes the SVG layer ribbons paint into. It holds
 * no row, column or ribbon logic — those live in their own features.
 */

/** A measured layout with the scroll taken out of every box. */
export interface SurfaceLayout {
	readonly columns: ReadonlyMap<string, Box>;
	/** Content coordinates: top/bottom ignore the pane's scroll. */
	readonly anchors: ReadonlyMap<string, Box>;
}

/** A lookup over a layout at a given scroll offset: content → screen box. */
export type AnchorLookup = (column: string, id: string) => Box | null;

export const anchorKey = (column: string, id: string): string => `${column}::${id}`;
