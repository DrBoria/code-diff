import { useMemo } from "react";
import type { Column } from "../../columns/column-types.js";
import type { Ribbon } from "../ribbon-types.js";
import type { Theme, SemanticColor } from "../../styles/theme-types.js";
import { colorOf } from "../../styles/theme-types.js";

/**
 * ── THE ONE SOURCE OF TONE ─────────────────────────────────────────────────
 *
 * All tone logic lives in the ribbon feature. A row may state its own semantic
 * key; a ribbon states its key; the colour itself ALWAYS comes from the theme
 * (props/config) — the board never invents a hue. Hover never changes the hue:
 * the focused chain is painted in the key's single `hot` shade, uniformly.
 */

export interface ToneApi {
	/** The resolved semantic key of a ribbon (its own, else its rows' unanimous key). */
	readonly toneOf: (ribbon: Ribbon) => string;
	/** The colour of a key, from the theme. */
	readonly colorOfKey: (key: string) => SemanticColor;
	/** The standing fill of a ribbon. */
	readonly fillOf: (ribbon: Ribbon) => string;
	/** The uniform hot fill of a focused ribbon (same hue, one intensity). */
	readonly hotOf: (ribbon: Ribbon) => string;
}

export const useRibbonTone = (ribbons: readonly Ribbon[], columns: readonly Column[], theme: Theme): ToneApi => {
	const rowTone = useMemo(() => {
		const map = new Map<string, string>();
		for (const column of columns) for (const row of column.rows ?? []) if (row.tone !== undefined) map.set(`${column.id}::${String(row.id)}`, row.tone);
		return map;
	}, [columns]);

	return useMemo(() => {
		const toneOf = (ribbon: Ribbon): string => {
			let seen: string | null = null;
			for (const end of ribbon.ends ?? []) {
				for (const id of end.rows ?? []) {
					const tone = rowTone.get(`${end.column}::${String(id)}`);
					if (tone === undefined) continue;
					if (seen === null) seen = tone;
					else if (seen !== tone) return ribbon.tone ?? "duplicate";
				}
			}
			return seen ?? ribbon.tone ?? "duplicate";
		};
		const colorOfKey = (key: string): SemanticColor => colorOf(theme, key);
		return {
			toneOf,
			colorOfKey,
			fillOf: (ribbon) => colorOfKey(toneOf(ribbon)).fill,
			hotOf: (ribbon) => {
				const color = colorOfKey(toneOf(ribbon));
				return color.hot ?? color.fill;
			},
		};
	}, [ribbons, rowTone, theme]);
};
