/**
 * Turn a two-sided line diff into board columns + ribbons. A changed line is ONE
 * row (not delete+add); only the differing token is painted, and an explanation
 * under the line says what was replaced/added/removed. Folding is the VIEW's job:
 * every row is emitted, equal rows are named by no ribbon, and the board folds
 * those unconnected runs itself.
 */
import { diffLines } from "../index.js";
import type { Column, Row, RowTextSpan, ExplanationNote, Ribbon, RibbonEnd } from "../index.js";

type Cell = { text?: string; words?: readonly { text: string; changed: boolean }[] } | null;

const spansOf = (cell: Cell): RowTextSpan[] | undefined => {
	if (!cell) return undefined;
	if (cell.words) return cell.words.map((w) => ({ text: w.text, paint: w.changed }));
	if (cell.text !== undefined) return [{ text: cell.text }];
	return undefined;
};

const textOf = (cell: Cell): string => {
	if (!cell) return "";
	if (cell.words) return cell.words.map((w) => w.text).join("");
	return cell.text ?? "";
};

const explanationOf = (type: string, a: Cell, b: Cell): ExplanationNote | undefined => {
	if (type === "add") return { text: "added", tone: "added" };
	if (type === "remove") return { text: "removed", tone: "removed" };
	if (type !== "change") return undefined;
	const removed = (a?.words ?? []).filter((w) => w.changed).map((w) => w.text.trim()).filter(Boolean);
	const added = (b?.words ?? []).filter((w) => w.changed).map((w) => w.text.trim()).filter(Boolean);
	const quote = (parts: string[]): string => parts.map((p) => `\`${p}\``).join(" ");
	if (removed.length > 0 && added.length > 0) return { text: `replaced ${quote(removed)} with ${quote(added)}`, tone: "changed" };
	if (added.length > 0) return { text: `added ${quote(added)}`, tone: "added" };
	if (removed.length > 0) return { text: `removed ${quote(removed)}`, tone: "removed" };
	const from = textOf(a).trim();
	const to = textOf(b).trim();
	if (from && to) return { text: `replaced \`${from}\` with \`${to}\``, tone: "changed" };
	return { text: "changed", tone: "changed" };
};

export interface GitBoard {
	columns: Column[];
	ribbons: readonly Ribbon[];
	counts: Record<string, number>;
}

export const gitBoard = (before: string, after: string): GitBoard => {
	const { rows, counts } = diffLines({ startLine: 1, lines: before.split("\n") }, { startLine: 1, lines: after.split("\n") }, { context: 0 });
	const left: Row[] = [];
	const right: Row[] = [];
	const ribbons: Ribbon[] = [];
	let hunk: { left: string[]; right: string[]; tone: string } | null = null;
	const flush = (): void => {
		if (hunk === null) return;
		const ends: RibbonEnd[] = [];
		if (hunk.left.length) ends.push({ column: "left", rows: hunk.left });
		if (hunk.right.length) ends.push({ column: "right", rows: hunk.right });
		if (ends.length) ribbons.push({ id: `hunk-${ribbons.length}`, tone: hunk.tone, ends });
		hunk = null;
	};

	rows.forEach((row, i) => {
		const id = String(i);
		const lid = `L${id}`;
		const rid = `R${id}`;
		if (row.type === "fold") {
			flush();
			(row.rows ?? []).forEach((eq, j) => {
				const [ea, eb] = eq.cells;
				const eid = `${id}-${j}`;
				if (ea) left.push({ id: `L${eid}`, plate: String(ea.no), spans: spansOf(ea) });
				if (eb) right.push({ id: `R${eid}`, plate: String(eb.no), spans: spansOf(eb) });
			});
			return;
		}
		const [a, b] = row.cells;
		if (row.type === "equal") {
			flush();
			if (a) left.push({ id: lid, plate: String(a.no), spans: spansOf(a) });
			if (b) right.push({ id: rid, plate: String(b.no), spans: spansOf(b) });
			return;
		}
		const tone = row.type === "add" ? "added" : row.type === "remove" ? "removed" : "changed";
		const note = explanationOf(row.type, a, b);
		if (a) left.push({ id: lid, plate: String(a.no), tone, spans: spansOf(a), ...(note === undefined ? {} : { explanation: note }) });
		if (b) right.push({ id: rid, plate: String(b.no), tone, spans: spansOf(b), ...(note === undefined ? {} : { explanation: note }) });
		if (hunk === null) hunk = { left: [], right: [], tone };
		if (a) hunk.left.push(lid);
		if (b) hunk.right.push(rid);
	});
	flush();

	// A blank line touching a hunk belongs to the change visually: an equal empty
	// line right above/below changed rows read as a hole in the tint. Give it the
	// neighbouring hunk's tone so the block reads as one continuous band. Only
	// blank lines — real code keeps its own verdict.
	const blank = (row: Row): boolean => (row.spans ?? []).every((s) => s.text.trim() === "");
	const tintBlanks = (rows: Row[]): void => {
		rows.forEach((row, i) => {
			if (row.tone === undefined) return;
			for (const j of [i - 1, i + 1]) {
				const near = rows[j];
				if (near !== undefined && near.tone === undefined && blank(near)) rows[j] = { ...near, tone: row.tone };
			}
		});
	};
	tintBlanks(left);
	tintBlanks(right);

	const columns: Column[] = [
		{ id: "left", rows: left, ratio: 1, mirrored: true },
		{ id: "right", rows: right, ratio: 1 },
	];
	return { columns, ribbons, counts };
};
