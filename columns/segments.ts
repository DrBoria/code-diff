import type { Mark, Segment, Token } from "../interface/types.js";

/**
 * A line → the pieces it is drawn from.
 *
 * The owner hands a plain `text`, its `tokens` (coloured by the owner's own
 * tokenizer) and the `marks` — character ranges the owner says must be painted.
 * Cutting the line where either the token colour or the marked state changes is
 * display work, so it lives HERE, in the package. No column id, no "left"/"right":
 * the same code paints column 1 and column 89.
 */
// A row can carry a standing mark AND a focused one over the same characters (the
// name is always underlined; the lane under the pointer says "this one"). The FOCUSED
// range wins — otherwise the pointer could never be seen to point at anything.
const markAt = (marks: readonly Mark[], at: number): Mark | null => {
	let found: Mark | null = null;
	for (const mark of marks) {
		if (at < mark.from || at >= mark.to) continue;
		if (mark.strong === true) return mark;
		if (found === null) found = mark;
	}

	return found;
};

export const buildSegments = (text: string, tokens: readonly Token[], marks: readonly Mark[]): readonly Segment[] => {
	const out: Segment[] = [];
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

	// A missing tokenizer is not an error: the line is one uncoloured token and
	// the marks still paint it.
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
