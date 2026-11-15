import type { Column } from "./column-types.js";
import type { Row, RowTextSpan, TextRangeHighlight, Token } from "../rows/row-types.js";
import type { BoardProps } from "../board/board-types.js";
import { buildSpans } from "../rows/row-text.js";
import { colorOf, type Theme } from "../styles/theme-types.js";

/**
 * The pure view-model of one row: which spans to draw, which wash sits behind
 * its marks, which ink its explanation uses. No React, no events — ColumnRow
 * renders exactly what this decides.
 */
export interface RowView {
	readonly spans: readonly RowTextSpan[];
	readonly paint: string | undefined;
	readonly explanationInk: string | undefined;
}

export interface RowViewArgs {
	readonly row: Row;
	readonly column: Column;
	readonly focus: readonly TextRangeHighlight[];
	readonly theme: Theme;
	readonly tokenize: BoardProps["tokenize"];
}

/** The row's text spans: explicit spans win; else tokens + marks + focus. */
const spansOf = (row: Row, column: Column, focus: readonly TextRangeHighlight[], tokenize: BoardProps["tokenize"]): readonly RowTextSpan[] => {
	if (row.spans !== undefined) return row.spans;
	if (row.text === undefined) return [{ text: String(row.id) }];
	const marks = focus.length === 0 ? (row.marks ?? []) : [...(row.marks ?? []), ...focus];
	const tokens: readonly Token[] = tokenize?.(row.text, column.id) ?? [{ text: row.text }];
	return buildSpans(row.text, tokens, marks);
};

export const rowViewOf = ({ row, column, focus, theme, tokenize }: RowViewArgs): RowView => {
	const rowColor = row.tone === undefined ? undefined : colorOf(theme, row.tone);
	const explanationTone = row.explanation?.tone ?? row.tone;
	return {
		spans: spansOf(row, column, focus, tokenize),
		paint: rowColor?.paint,
		explanationInk: explanationTone === undefined ? undefined : colorOf(theme, explanationTone).text,
	};
};
