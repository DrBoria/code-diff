/**
 * ── RIBBON MODEL HELPERS ───────────────────────────────────────────────────
 *
 * Pure display math the owner's domain uses to turn semantic facts into ribbons:
 * locate a name in the rows, pair each range with its duplicate, resolve links
 * into ribbons, and group consecutive rows into one ribbon. No DOM, no colour.
 */
import type { Ribbon, RibbonTextAnchor } from "./ribbon-types.js";

/** One row as mark resolution needs it: a cell per column. */
export interface MarkRow {
	readonly type: string;
	readonly cells: readonly (MarkCell | null)[];
	readonly rows?: readonly MarkRow[];
}
export interface MarkCell {
	readonly no: number | string;
	readonly text?: string;
	readonly words?: readonly { readonly text: string }[];
}
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

export interface Located {
	readonly line: string;
	readonly from: number;
	readonly to: number;
}

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
			if (line != null && String(cell.no) === String(line)) return found;
			if (!fallback) fallback = found;
		}
		return null;
	};
	return visit(rows) ?? fallback;
};

/** A mark carrying the identity the model gave it, before duplicates resolve. */
export interface KeyedMark extends RibbonTextAnchor {
	readonly name: string;
	readonly key?: string;
}

const dupOf = (mark: RibbonTextAnchor): { column: string; line: string; from: number; to: number } => ({ column: mark.column, line: mark.line, from: mark.from, to: mark.to });

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
		(a as { duplicate?: unknown }).duplicate = dupOf(b);
		(b as { duplicate?: unknown }).duplicate = dupOf(a);
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

/** Resolve duplicates in place: by KEY first, then by NAME for what is left. */
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

/** Resolve semantic links into ribbons with anchors + duplicates. */
export const resolveLanes = (rows: readonly MarkRow[], columns: readonly string[], links: readonly MemberLink[]): Ribbon[] => {
	const lanes: { link: MemberLink; left: Located; right: Located }[] = [];
	const allMarks: KeyedMark[] = [];
	const marksByLane: KeyedMark[][] = [];
	for (const link of links) {
		const left = locate(rows, columnIndex(columns, link.leftColumn), link.left.name, undefined, link.left.line);
		const right = locate(rows, columnIndex(columns, link.rightColumn), link.right.name, undefined, link.right.line);
		if (!left || !right) continue;
		const leftMark: KeyedMark = { column: link.leftColumn, line: left.line, from: left.from, to: left.to, name: link.left.name, ...(link.left.key === undefined ? {} : { key: link.left.key }) };
		const rightMark: KeyedMark = { column: link.rightColumn, line: right.line, from: right.from, to: right.to, name: link.right.name, ...(link.right.key === undefined ? {} : { key: link.right.key }) };
		lanes.push({ link, left, right });
		marksByLane.push([leftMark, rightMark]);
		allMarks.push(leftMark, rightMark);
	}
	pairTwins(allMarks);
	return lanes.map(({ link, left, right }, index) => {
		const pair = marksByLane[index] ?? [];
		const anchors: RibbonTextAnchor[] = pair.map(({ column, line, from, to, duplicate }) => (duplicate === undefined ? { column, line, from, to } : { column, line, from, to, duplicate }));
		return {
			id: link.connectionId,
			...(link.label === undefined ? {} : { label: link.label }),
			tone: link.tone ?? "duplicate",
			ends: [
				{ column: link.leftColumn, rows: [left.line] },
				{ column: link.rightColumn, rows: [right.line] },
			],
			anchors,
		};
	});
};

// Row-level grouping lives in its own file (ribbon-group.ts).
export { buildConnections, type RowLink, type BandCaption } from "./ribbon-group.js";
