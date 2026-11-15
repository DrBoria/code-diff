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
}

const keyOf = (column: string, id: string | number): string => `${column}::${String(id)}`;

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
				const key = keyOf(ref.column, ref.row);
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
				void key;
				return best === null ? null : chainOf(best);
			},
		};
	}, [ribbons]);
