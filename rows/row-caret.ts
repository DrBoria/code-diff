/**
 * WHICH CHARACTER of a row the pointer is over. The board highlights a RANGE,
 * and "the piece under the pointer" is a range too — a row can carry a dozen of
 * them, so the row alone is not precise enough. The offset comes from the
 * browser's caret, counted over the row's text nodes — never from glyph math.
 */

/** The caret node + offset at a screen point. */
interface CaretPosition {
	readonly offsetNode: Node | null;
	readonly offset: number;
}

/** The spellings a browser may expose — jsdom exposes neither. */
interface CaretDocument {
	caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node | null; offset: number } | null;
	caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

/** The caret node + offset at a screen point, whichever API the browser has. */
const caretAt = (doc: Document, x: number, y: number): CaretPosition | null => {
	const caret: CaretDocument = doc;
	const standard = caret.caretPositionFromPoint?.(x, y);
	if (standard != null) return { offsetNode: standard.offsetNode, offset: standard.offset };
	const range = caret.caretRangeFromPoint?.(x, y);
	if (range == null) return null;
	return { offsetNode: range.startContainer, offset: range.startOffset };
};

/** Count text-node characters from the row's start to the caret node. */
const offsetInRow = (row: HTMLElement, node: Node, offset: number): number | undefined => {
	let total = 0;
	const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
	for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
		if (current === node) return total + offset;
		total += (current.textContent ?? "").length;
	}
	return undefined;
};

export const charAt = (row: HTMLElement | null, x: number, y: number): number | undefined => {
	if (row === null) return undefined;
	const caret = caretAt(document, x, y);
	if (caret === null || caret.offsetNode === null || !row.contains(caret.offsetNode)) return undefined;
	return offsetInRow(row, caret.offsetNode, caret.offset);
};
