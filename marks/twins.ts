// ── TWINS · pair each mark with its duplicate on the other side ────────────
//
// A lane joins rows, but a reader points at a WORD. The answer to "what is this
// duplicated with?" is one range over there, not the row it sits in. This module
// pairs marks: first by identity KEY (a property's value, a method's signature),
// then by NAME in order — so two members that share a name but differ in value
// still pair by their position. Pure display math; the model only said they match.

import type { LaneMark } from "../interface/types.js";

/** A mark carrying the identity the model gave it, before twins are resolved. */
export interface KeyedMark extends LaneMark {
	readonly name: string;
	readonly key?: string;
}

const twinOf = (mark: LaneMark): { column: string; line: string; from: number; to: number } => ({
	column: mark.column,
	line: mark.line,
	from: mark.from,
	to: mark.to,
});

// Pair the k-th occurrence on one side with the k-th on the other, for one group.
const pairSides = (group: readonly KeyedMark[]): void => {
	const sides = new Map<string, KeyedMark[]>();
	for (const mark of group) {
		const list = sides.get(mark.column) ?? [];
		list.push(mark);
		sides.set(mark.column, list);
	}
	const columns = [...sides.keys()];
	if (columns.length < 2) return;
	const left = sides.get(columns[0] as string) ?? [];
	const right = sides.get(columns[1] as string) ?? [];
	for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
		const a = left[index];
		const b = right[index];
		if (!a || !b) continue;
		(a as { twin?: unknown }).twin = twinOf(b);
		(b as { twin?: unknown }).twin = twinOf(a);
	}
};

const groupBy = (marks: readonly KeyedMark[], keyOf: (mark: KeyedMark) => string): Map<string, KeyedMark[]> => {
	const groups = new Map<string, KeyedMark[]>();
	for (const mark of marks) {
		const key = keyOf(mark);
		const list = groups.get(key) ?? [];
		list.push(mark);
		groups.set(key, list);
	}

	return groups;
};

/**
 * Resolve twins in place: by KEY first (identity), then by NAME for whatever is
 * left. Returns the marks as plain LaneMarks (the helper fields dropped).
 */
export const pairTwins = (marks: readonly KeyedMark[]): LaneMark[] => {
	for (const group of groupBy(marks, (m) => m.key ?? m.name).values()) pairSides(group);
	const unpaired = marks.filter((m) => m.twin === undefined);
	for (const group of groupBy(unpaired, (m) => m.name).values()) pairSides(group);

	return marks.map(({ column, line, from, to, twin }) => (twin === undefined ? { column, line, from, to } : { column, line, from, to, twin }));
};