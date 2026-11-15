import { useMemo } from "react";
import type { Ribbon, RibbonTextAnchor } from "../ribbon-types.js";
import type { RowRef } from "../../rows/row-types.js";

/**
 * ── THE CHAIN ──────────────────────────────────────────────────────────────
 *
 * A ribbon is ONE logical entity. Hovering any piece of it — a word, a row, a
 * connector, a caption, in ANY column — resolves to the SAME chain: every end,
 * every connector, every caption, every text anchor (and its duplicate). The
 * chain is painted at ONE uniform intensity; nothing else lights. Because the
 * chain is a single object, both sides light the exact same set — symmetry is
 * automatic, not computed per side.
 */

export interface Chain {
	readonly ribbon: Ribbon;
	/** Row keys (column::id) the chain covers. */
	readonly rows: ReadonlySet<string>;
	/** Text anchors to underline (including duplicates). */
	readonly anchors: readonly RibbonTextAnchor[];
}

export interface ChainApi {
	/** The chain a hovered row belongs to (most specific ribbon naming it). */
	readonly chainOfRow: (ref: RowRef) => Chain | null;
	/** The chain of a ribbon id. */
	readonly chainOfRibbon: (id: string) => Chain | null;
	/**
	 * The chain a WORD belongs to: the ribbon whose text anchor covers this
	 * character. A row carries a dozen nested anchors (`return` ⊃ `call` ⊃ the
	 * whole body); pointing at a word must light the lane that MARKS it, not the
	 * first lane that happens to name the row.
	 */
	readonly chainOfWord: (ref: RowRef, char: number, line?: string) => Chain | null;
}

const keyOf = (column: string, id: string | number): string => `${column}::${String(id)}`;

/** The narrowest anchor covering this character on this column/line, if any. */
const narrowestAnchor = (ribbons: readonly Ribbon[], ref: RowRef, char: number, rowLine: string): Ribbon | null => {
	let best: Ribbon | null = null;
	let bestSpan = Infinity;
	for (const ribbon of ribbons) {
		for (const anchor of ribbon.anchors ?? []) {
			if (anchor.column !== ref.column || String(anchor.line) !== rowLine) continue;
			if (anchor.from > char || char >= anchor.to) continue;
			const span = anchor.to - anchor.from;
			if (span < bestSpan) {
				bestSpan = span;
				best = ribbon;
			}
		}
	}
	return best;
};

export const useRibbonChain = (ribbons: readonly Ribbon[]): ChainApi =>
	useMemo(() => {
		const chainOf = (ribbon: Ribbon): Chain => {
			const rows = new Set<string>();
			for (const end of ribbon.ends ?? []) for (const id of end.rows ?? []) rows.add(keyOf(end.column, id));
			const anchors: RibbonTextAnchor[] = [];
			for (const anchor of ribbon.anchors ?? []) {
				anchors.push(anchor);
				if (anchor.duplicate !== undefined) anchors.push({ ...anchor.duplicate });
			}
			return { ribbon, rows, anchors };
		};
		const byId = new Map(ribbons.map((r) => [r.id, r]));
		return {
			chainOfRibbon: (id) => {
				const ribbon = byId.get(id);
				return ribbon === undefined ? null : chainOf(ribbon);
			},
			chainOfRow: (ref) => {
				// The most specific ribbon naming this row: the one with the fewest rows.
				let best: Ribbon | null = null;
				let bestSize = Infinity;
				for (const ribbon of ribbons) {
					const names = (ribbon.ends ?? []).some((end) => end.column === ref.column && (end.rows ?? []).some((id) => String(id) === String(ref.row)));
					if (!names) continue;
					const size = (ribbon.ends ?? []).reduce((n, end) => n + (end.rows ?? []).length, 0);
					if (size < bestSize) {
						bestSize = size;
						best = ribbon;
					}
				}
				return best === null ? null : chainOf(best);
			},
			chainOfWord: (ref, char, line) => {
				const best = narrowestAnchor(ribbons, ref, char, line ?? String(ref.row));
				return best === null ? null : chainOf(best);
			},
		};
	}, [ribbons]);
