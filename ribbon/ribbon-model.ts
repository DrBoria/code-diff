/**
 * ── RIBBON MODEL HELPERS ───────────────────────────────────────────────────
 *
 * Pure display math the owner's domain uses to turn semantic facts into ribbons:
 * locate a name in the rows, pair each range with its duplicate, resolve links
 * into ribbons, and group consecutive rows into one ribbon. No DOM, no colour.
 */
import type { Ribbon, RibbonTextAnchor } from "./ribbon-types.js";
import type { LineCell, LineRow } from "../rows/diff.js";

/** One row/cell as mark resolution needs it: the comparison's own row shape,
 *  widened only where a fold may nest rows. */
export type MarkCell = Omit<LineCell, "no"> & { readonly no: number | string };
export type MarkRow = Omit<LineRow, "cells" | "rows"> & {
	readonly cells: readonly (MarkCell | null)[];
	readonly rows?: readonly MarkRow[];
};
export interface MemberLinkEnd {
	readonly name: string;
	readonly key?: string;
	readonly line?: number;
}
export interface MemberLink {
	readonly connectionId: string;
	readonly label?: string;
	readonly tone?: string;
	readonly leftColumn: string;
	readonly rightColumn: string;
	readonly left: MemberLinkEnd;
	readonly right: MemberLinkEnd;
}

export const cellText = (cell: MarkCell | null | undefined): string => {
	if (cell == null) return "";
	if (cell.words) return cell.words.map((word) => word.text).join("");
	return cell.text ?? "";
};

export const rangeOf = (text: string, name: string): { from: number; to: number } | null => {
	if (!name) return null;
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(`\\b${escaped}\\b`).exec(text);
	if (!match) return null;
	return { from: match.index, to: match.index + name.length };
};

/** A located range: an anchor's text coordinates, before its column is known. */
export type Located = Pick<RibbonTextAnchor, "line" | "from" | "to">;

export interface LocateArgs {
	readonly rows: readonly MarkRow[];
	readonly column: number;
	readonly name: string;
	readonly predicate?: (text: string) => boolean;
	readonly line?: number;
}

/** The range a name occupies in ONE row's cell, if the row admits it. */
const locatedIn = (row: MarkRow, args: LocateArgs): Located | null => {
	const cell = row.cells[args.column];
	if (!cell || cell.no == null) return null;
	const text = cellText(cell);
	if (args.predicate && !args.predicate(text)) return null;
	const range = rangeOf(text, args.name);
	if (!range) return null;
	return { line: String(cell.no), from: range.from, to: range.to };
};

/** The range a name occupies in one column's rows; the asked line wins. */
export const locate = (args: LocateArgs): Located | null => {
	let fallback: Located | null = null;
	const visit = (list: readonly MarkRow[]): Located | null => {
		for (const row of list) {
			if (row.type === "fold") {
				const nested = row.rows ? visit(row.rows) : null;
				if (nested) return nested;
				continue;
			}
			const found = locatedIn(row, args);
			if (found === null) continue;
			if (args.line != null && found.line === String(args.line)) return found;
			fallback ??= found;
		}
		return null;
	};
	return visit(args.rows) ?? fallback;
};

/** A mark carrying the identity the model gave it, before duplicates resolve.
 *  `duplicate` is mutable here: pairing writes the twin into the mark itself. */
export interface KeyedMark extends Omit<RibbonTextAnchor, "duplicate"> {
	readonly name: string;
	readonly key?: string;
	duplicate?: { column: string; line: string; from: number; to: number };
}

const dupOf = (mark: RibbonTextAnchor): { column: string; line: string; from: number; to: number } => ({ column: mark.column, line: mark.line, from: mark.from, to: mark.to });

/** Pair the k-th occurrence on one side with the k-th on the other, for one group. */
const pairSides = (group: readonly KeyedMark[]): void => {
	const sides = new Map<string, KeyedMark[]>();
	for (const mark of group) {
		const list = sides.get(mark.column) ?? [];
		list.push(mark);
		sides.set(mark.column, list);
	}
	const [first, second] = [...sides.values()];
	if (first === undefined || second === undefined) return;
	for (let index = 0; index < Math.min(first.length, second.length); index += 1) {
		const a = first[index];
		const b = second[index];
		if (!a || !b) continue;
		a.duplicate = dupOf(b);
		b.duplicate = dupOf(a);
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

/** Resolve duplicates: by KEY first (identity), then by NAME for what is left. */
export const pairTwins = (marks: readonly KeyedMark[]): RibbonTextAnchor[] => {
	for (const group of groupBy(marks, (m) => m.key ?? m.name).values()) pairSides(group);
	const unpaired = marks.filter((m) => m.duplicate === undefined);
	for (const group of groupBy(unpaired, (m) => m.name).values()) pairSides(group);
	return marks.map(({ column, line, from, to, duplicate }) => (duplicate === undefined ? { column, line, from, to } : { column, line, from, to, duplicate }));
};

const columnIndex = (columns: readonly string[], id: string): number => {
	const index = columns.indexOf(id);
	return index === -1 ? 0 : index;
};

/** One link's located ends, as keyed marks ready for twin pairing. A name that
 *  exists on ONE side only still gets a lane (one end, one mark): an added or
 *  removed member is part of the comparison, not invisible. */
const laneMarks = (rows: readonly MarkRow[], columns: readonly string[], link: MemberLink): { left: Located | null; right: Located | null; marks: KeyedMark[] } | null => {
	const left = locate({ rows, column: columnIndex(columns, link.leftColumn), name: link.left.name, line: link.left.line });
	const right = locate({ rows, column: columnIndex(columns, link.rightColumn), name: link.right.name, line: link.right.line });
	if (!left && !right) return null;
	const mark = (column: string, end: MemberLinkEnd, at: Located): KeyedMark => ({ column, line: at.line, from: at.from, to: at.to, name: end.name, ...(end.key === undefined ? {} : { key: end.key }) });
	const marks: KeyedMark[] = [];
	if (left) marks.push(mark(link.leftColumn, link.left, left));
	if (right) marks.push(mark(link.rightColumn, link.right, right));
	return { left, right, marks };
};

/** Resolve semantic links into ribbons with anchors + duplicates. */
export const resolveLanes = (rows: readonly MarkRow[], columns: readonly string[], links: readonly MemberLink[]): Ribbon[] => {
	const lanes: { link: MemberLink; left: Located | null; right: Located | null; marks: KeyedMark[] }[] = [];
	for (const link of links) {
		const resolved = laneMarks(rows, columns, link);
		if (resolved !== null) lanes.push({ link, ...resolved });
	}
	pairTwins(lanes.flatMap((lane) => lane.marks));
	return lanes.map(({ link, left, right, marks }) => {
		const ends: { column: string; rows: string[] }[] = [];
		if (left !== null) ends.push({ column: link.leftColumn, rows: [left.line] });
		if (right !== null) ends.push({ column: link.rightColumn, rows: [right.line] });
		return {
			id: link.connectionId,
			...(link.label === undefined ? {} : { label: link.label }),
			tone: link.tone ?? (left !== null && right !== null ? "duplicate" : "unique"),
			ends,
			anchors: marks.map(({ column, line, from, to, duplicate }) => (duplicate === undefined ? { column, line, from, to } : { column, line, from, to, duplicate })),
		};
	});
};

// Row-level grouping lives in its own file (ribbon-group.ts).
export { buildConnections, type RowLink, type BandCaption } from "./ribbon-group.js";
