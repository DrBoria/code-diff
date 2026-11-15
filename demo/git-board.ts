// Turn a two-sided line diff into board columns + connections, the same way the
// uniqueness reports do: a changed line is ONE row (not delete+add), only the
// differing token is painted. This is the "as was / as now" git view — WebStorm's
// split diff, rebuilt on the generic N-column board.
//
// Folding is the VIEW's job, not the adapter's: every row is emitted, equal rows
// are named by no connection, and the board folds those unconnected runs itself
// (keeping `diffContext` lines at each end, expandable via its own reveal button).
// Changed/added/removed runs become ONE ribbon per hunk.

import { diffLines } from "../index.js";
import type { ChangeNote, Column, Connection, Item, Segment } from "../interface/types.js";

const segmentsOf = (cell: { text?: string; words?: readonly { text: string; changed: boolean }[] } | null): Segment[] | undefined => {
	if (!cell) return undefined;
	if (cell.words) return cell.words.map((w) => ({ text: w.text, paint: w.changed }));
	if (cell.text !== undefined) return [{ text: cell.text }];
	return undefined;
};

const textOf = (cell: { text?: string; words?: readonly { text: string; changed: boolean }[] } | null): string => {
	if (!cell) return "";
	if (cell.words) return cell.words.map((w) => w.text).join("");
	return cell.text ?? "";
};

/**
 * WHAT HAPPENED on a changed row, written under the code line. A changed line is a
 * REPLACEMENT: the explanation names the tokens that went away and the tokens that
 * arrived, so the reader sees "replaced `money` with `cash`" instead of two painted
 * ranges with no story. A one-sided row is an addition or a removal.
 */
const changeNote = (type: string, a: { text?: string; words?: readonly { text: string; changed: boolean }[] } | null, b: { text?: string; words?: readonly { text: string; changed: boolean }[] } | null): ChangeNote | undefined => {
	if (type === "add") return { text: "added", tone: "added" };
	if (type === "remove") return { text: "removed", tone: "removed" };
	if (type !== "change") return undefined;
	const removed = (a?.words ?? []).filter((w) => w.changed).map((w) => w.text.trim()).filter(Boolean);
	const added = (b?.words ?? []).filter((w) => w.changed).map((w) => w.text.trim()).filter(Boolean);
	const quote = (parts: string[]): string => parts.map((p) => `\`${p}\``).join(" ");
	if (removed.length > 0 && added.length > 0) return { text: `replaced ${quote(removed)} with ${quote(added)}`, tone: "differs" };
	if (added.length > 0) return { text: `added ${quote(added)}`, tone: "added" };
	if (removed.length > 0) return { text: `removed ${quote(removed)}`, tone: "removed" };
	// A change with no token-level diff (a whole-line rewrite above the token limit):
	// name the two texts so the reader still sees what was replaced.
	const from = textOf(a).trim();
	const to = textOf(b).trim();
	if (from && to) return { text: `replaced \`${from}\` with \`${to}\``, tone: "differs" };
	return { text: "changed", tone: "differs" };
};

export interface GitBoard {
	columns: Column[];
	connections: readonly Connection[];
	counts: Record<string, number>;
}

export const gitBoard = (before: string, after: string, context = 3): GitBoard => {
	// context:0 keeps every row (no pre-folding) — the board folds equal runs itself.
	const { rows, counts } = diffLines({ startLine: 1, lines: before.split("\n") }, { startLine: 1, lines: after.split("\n") }, { context: 0 });

	const left: Item[] = [];
	const right: Item[] = [];
	const connections: Connection[] = [];

	// Accumulate the current run of non-equal rows into one hunk connection.
	let hunk: { left: string[]; right: string[]; tone: string } | null = null;
	const flush = () => {
		if (hunk === null) return;
		const ends = [];
		if (hunk.left.length) ends.push({ column: "left", items: hunk.left });
		if (hunk.right.length) ends.push({ column: "right", items: hunk.right });
		if (ends.length) connections.push({ id: `hunk-${connections.length}`, tone: hunk.tone, ends });
		hunk = null;
	};

	rows.forEach((row, i) => {
		const id = String(i);
		const lid = `L${id}`;
		const rid = `R${id}`;

		if (row.type === "fold") {
			// diffLines pre-folds equal runs; expand them back into individual equal
			// rows (named by NO connection) so the VIEW folds them with its own
			// diffContext + reveal button. Each hidden row keeps its real line number.
			flush();
			const hidden = row.rows ?? [];
			hidden.forEach((eq, j) => {
				const [ea, eb] = eq.cells;
				const eid = `${id}-${j}`;
				if (ea) left.push({ id: `L${eid}`, plate: String(ea.no), segments: segmentsOf(ea) });
				if (eb) right.push({ id: `R${eid}`, plate: String(eb.no), segments: segmentsOf(eb) });
			});
			return;
		}

		const [a, b] = row.cells;
		if (row.type === "equal") {
			flush();
			if (a) left.push({ id: lid, plate: String(a.no), segments: segmentsOf(a) });
			if (b) right.push({ id: rid, plate: String(b.no), segments: segmentsOf(b) });
			return;
		}

		// The tone follows the row's own verdict: a replacement is `differs`, a pure
		// addition is `added`, a pure removal is `removed` — the same colour the
		// explanation under the line is written in.
		const tone = row.type === "add" ? "added" : row.type === "remove" ? "removed" : "differs";
		const note = changeNote(row.type, a, b);
		if (a) left.push({ id: lid, plate: String(a.no), tone, segments: segmentsOf(a), ...(note === undefined ? {} : { change: note }) });
		if (b) right.push({ id: rid, plate: String(b.no), tone, segments: segmentsOf(b), ...(note === undefined ? {} : { change: note }) });
		if (hunk === null) hunk = { left: [], right: [], tone };
		if (a) hunk.left.push(lid);
		if (b) hunk.right.push(rid);
	});
	flush();

	const columns: Column[] = [
		{ id: "left", kind: "items", items: left, ratio: 1, mirrored: true },
		{ id: "right", kind: "items", items: right, ratio: 1 },
	];

	return { columns, connections, counts };
};
