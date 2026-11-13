// ── RESOLVE · semantic links → drawn lanes ─────────────────────────────────
//
// The model hands a list of MemberLinks (which name matches which, under a
// connectionId). This turns each into a Connection the board can draw: it locates
// the name on each side, builds the marks, and pairs twins. The model never
// computed a range; the view did all of it.

import type { LaneMark } from "../interface/types.js";
import { locate, type Located } from "./locate.js";
import { pairTwins, type KeyedMark } from "./twins.js";
import type { MarkRow, MemberLink, ResolvedLane } from "./types.js";

const columnIndex = (columns: readonly string[], id: string): number => {
	const index = columns.indexOf(id);

	return index === -1 ? 0 : index;
};

const markOf = (column: string, at: Located, name: string, key: string | undefined): KeyedMark => ({
	column,
	line: at.line,
	from: at.from,
	to: at.to,
	name,
	...(key === undefined ? {} : { key }),
});

/**
 * Resolve every link into a lane. A link whose name cannot be found on a side is
 * skipped (the model said they match, but the row is not on screen). Marks of all
 * links are twin-paired together, so a name written twice pairs by occurrence.
 */
export const resolveLanes = (rows: readonly MarkRow[], columns: readonly string[], links: readonly MemberLink[]): ResolvedLane[] => {
	const lanes: { link: MemberLink; left: Located; right: Located }[] = [];
	const allMarks: KeyedMark[] = [];
	const marksByLane: KeyedMark[][] = [];

	for (const link of links) {
		const left = locate(rows, columnIndex(columns, link.leftColumn), link.left.name);
		const right = locate(rows, columnIndex(columns, link.rightColumn), link.right.name);
		if (!left || !right) continue;
		const leftMark = markOf(link.leftColumn, left, link.left.name, link.left.key);
		const rightMark = markOf(link.rightColumn, right, link.right.name, link.right.key);
		lanes.push({ link, left, right });
		marksByLane.push([leftMark, rightMark]);
		allMarks.push(leftMark, rightMark);
	}

	// Twins are resolved across ALL marks at once (a name may repeat across lanes).
	pairTwins(allMarks);

	return lanes.map(({ link, left, right }, index) => {
		const pair = marksByLane[index] ?? [];
		const marks: LaneMark[] = pair.map(({ column, line, from, to, twin }) => (twin === undefined ? { column, line, from, to } : { column, line, from, to, twin }));

		return {
			id: link.connectionId,
			...(link.label === undefined ? {} : { label: link.label }),
			tone: link.tone ?? "same",
			ends: [
				{ column: link.leftColumn, items: [left.line] },
				{ column: link.rightColumn, items: [right.line] },
			],
			marks,
		};
	});
};