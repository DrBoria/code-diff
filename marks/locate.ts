// ── LOCATE · where a name is written in the rows ───────────────────────────
//
// Pure display math: given the rows the board carries and a member name, find the
// row that declares it and the character range of the name on that row. Nothing
// here knows what a "property" or a "function" is — it only finds a word.

import type { MarkCell, MarkRow } from "./types.js";

/** The text of a cell, whether it is plain `text` or a word diff. */
export const cellText = (cell: MarkCell | null | undefined): string => {
	if (cell == null) return "";
	if (cell.words) return cell.words.map((word) => word.text).join("");

	return cell.text ?? "";
};

/** The character range of the first whole-word occurrence of `name` in `text`. */
export const rangeOf = (text: string, name: string): { from: number; to: number } | null => {
	if (!name) return null;
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(`\\b${escaped}\\b`).exec(text);
	if (!match) return null;

	return { from: match.index, to: match.index + name.length };
};

/** A located name: the row id it sits on and its range there. */
export interface Located {
	readonly line: string;
	readonly from: number;
	readonly to: number;
}

/**
 * Find the first row in `column` whose text declares `name`, and the name's range
 * on it. `predicate` lets the caller restrict which rows count (a declaration
 * head, a member line) without this module knowing the domain.
 *
 * `line` (optional) is the 1-based source line the model says the member is
 * declared on. When given, the row with that number wins over any earlier mention
 * of the same word (a doc comment above the declaration, a use elsewhere) — the
 * model knows WHERE the member is; the view still computes the character range.
 * If no row carries that line, the first matching row is used as before.
 */
export const locate = (rows: readonly MarkRow[], column: number, name: string, predicate?: (text: string) => boolean, line?: number): Located | null => {
	let fallback: Located | null = null;
	const visit = (list: readonly MarkRow[]): Located | null => {
		for (const row of list) {
			if (row.type === "fold") {
				const nested = row.rows ? visit(row.rows) : null;
				if (nested) return nested;
				continue;
			}
			const cell = row.cells[column];
			if (!cell || cell.no == null) continue;
			const text = cellText(cell);
			if (predicate && !predicate(text)) continue;
			const range = rangeOf(text, name);
			if (!range) continue;
			const found = { line: String(cell.no), from: range.from, to: range.to };
			// The declaration line the model named wins outright.
			if (line != null && String(cell.no) === String(line)) return found;
			if (!fallback) fallback = found;
		}

		return null;
	};
	const exact = visit(rows);

	return exact ?? fallback;
};