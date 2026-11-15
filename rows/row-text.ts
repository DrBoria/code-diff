import type { RowTextSpan, TextRangeHighlight, Token } from "./row-types.js";

/**
 * Cut a line into the pieces it is drawn from: the owner's tokens (coloured by
 * the owner's tokenizer) and the marked ranges. Display work, so it lives in the
 * rows feature. No column id, no left/right — the same code paints any column.
 */
const markAt = (marks: readonly TextRangeHighlight[], at: number): TextRangeHighlight | null => {
	let found: TextRangeHighlight | null = null;
	for (const mark of marks) {
		if (at < mark.from || at >= mark.to) continue;
		if (mark.strong === true) return mark;
		if (found === null) found = mark;
	}
	return found;
};

export const buildSpans = (text: string, tokens: readonly Token[], marks: readonly TextRangeHighlight[]): readonly RowTextSpan[] => {
	const out: RowTextSpan[] = [];
	let at = 0;
	let run = "";
	let ink: string | undefined;
	let paint = false;
	let strong = false;
	const flush = (): void => {
		if (run === "") return;
		const piece: { text: string; paint?: boolean; strong?: boolean; ink?: string } = { text: run };
		if (paint) piece.paint = true;
		if (strong) piece.strong = true;
		if (ink !== undefined) piece.ink = ink;
		out.push(piece);
		run = "";
	};
	const source: readonly Token[] = tokens.length > 0 ? tokens : [{ text }];
	for (const token of source) {
		for (const character of token.text) {
			const mark = markAt(marks, at);
			const nextInk = mark?.ink ?? token.ink;
			const nextPaint = mark !== null;
			const nextStrong = mark?.strong === true;
			if (nextInk !== ink || nextPaint !== paint || nextStrong !== strong) {
				flush();
				ink = nextInk;
				paint = nextPaint;
				strong = nextStrong;
			}
			run += character;
			at += 1;
		}
	}
	flush();
	return out;
};
