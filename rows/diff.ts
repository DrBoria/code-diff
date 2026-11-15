/**
 * ── ROWS OF A COMPARISON ──────────────────────────────────────────────────
 *
 * Aligns two texts into rows (LCS over lines), and inside a changed row an LCS
 * over tokens so only the differing identifier is marked. A row holds one cell
 * per column — never left/right. Long equal runs are folded with context kept.
 */
import { lcsOps, type Op } from "./diff-lcs.js";

export const ROW = { Equal: "equal", Change: "change", Add: "add", Remove: "remove", Fold: "fold" } as const;
export type RowType = (typeof ROW)[keyof typeof ROW];
export const DIFF = { Context: 3, MaxWordTokens: 400 } as const;
export const WORD_TOKEN_RE = /[\w$]+|\s+|[^\w$\s]/g;

export interface Word {
	readonly text: string;
	readonly changed: boolean;
}
export interface LineCell {
	readonly no: number;
	readonly text?: string;
	readonly words?: readonly Word[];
}
export interface LineRow {
	readonly type: RowType;
	readonly cells: readonly (LineCell | null)[];
	readonly rows?: readonly LineRow[];
}
export interface Span {
	readonly startLine: number;
	readonly lines: readonly string[];
}
export interface DiffOptions {
	readonly context?: number;
	readonly maxWordTokens?: number;
}

const splitTokens = (text: string): string[] => String(text ?? "").match(WORD_TOKEN_RE) ?? [];

/** Merge adjacent word runs of the same changed state. */
const pushRun = (out: Word[], text: string, changed: boolean): void => {
	const last = out[out.length - 1];
	if (last && last.changed === changed) out[out.length - 1] = { text: last.text + text, changed };
	else out.push({ text, changed });
};

/** The two token sequences and the run lists an op feeds. */
interface WordDiff {
	readonly a: readonly string[];
	readonly b: readonly string[];
	readonly first: Word[];
	readonly second: Word[];
}

/** One word-diff op applied to both run lists. */
const applyWordOp = (op: Op, { a, b, first, second }: WordDiff): void => {
	const equal = op.type === "equal";
	if (op.type !== "add") pushRun(first, a[op.a ?? 0] ?? "", !equal);
	if (op.type !== "remove") pushRun(second, b[op.b ?? 0] ?? "", !equal);
};

/** Over the token budget the whole line is one changed run on each side. */
const wholeRuns = (first: string, second: string): readonly [readonly Word[], readonly Word[]] => [[{ text: String(first ?? ""), changed: true }], [{ text: String(second ?? ""), changed: true }]];

export const diffWords = (first: string, second: string, maxWordTokens: number = DIFF.MaxWordTokens): readonly [readonly Word[], readonly Word[]] => {
	const a = splitTokens(first);
	const b = splitTokens(second);
	if (Math.max(a.length, b.length) > maxWordTokens) return wholeRuns(first, second);
	const firstRuns: Word[] = [];
	const secondRuns: Word[] = [];
	for (const op of lcsOps(a, b)) applyWordOp(op, { a, b, first: firstRuns, second: secondRuns });
	return [firstRuns, secondRuns];
};

const cellOf = (no: number | null, text: string | null, words?: readonly Word[]): LineCell | null => {
	if (no == null) return null;
	if (words) return { no, words };
	return text == null ? { no } : { no, text };
};

const buildRow = (type: RowType, cells: [LineCell | null, LineCell | null], maxWordTokens: number): LineRow => {
	if (type !== ROW.Change) return { type, cells };
	const first = cells[0];
	const second = cells[1];
	if (!first || !second) return { type, cells };
	const [a, b] = diffWords(first.text ?? "", second.text ?? "", maxWordTokens);
	return { type, cells: [cellOf(first.no, null, a), cellOf(second.no, null, b)] };
};

/** The two texts a row addresses, with their line-number offsets. */
interface RowSource {
	readonly a: readonly string[];
	readonly b: readonly string[];
	readonly startA: number;
	readonly startB: number;
	readonly maxWordTokens: number;
}

const equalRow = (op: Op, src: RowSource): LineRow =>
	buildRow(ROW.Equal, [cellOf((op.a ?? 0) + src.startA, src.a[op.a ?? 0] ?? ""), cellOf((op.b ?? 0) + src.startB, src.b[op.b ?? 0] ?? "")], src.maxWordTokens);

/** Paired remove+add rows are changes. */
const changedRows = (removes: readonly Op[], adds: readonly Op[], src: RowSource): LineRow[] => {
	const rows: LineRow[] = [];
	for (let n = 0; n < Math.min(removes.length, adds.length); n += 1) {
		const ra = removes[n]?.a ?? 0;
		const ab = adds[n]?.b ?? 0;
		rows.push(buildRow(ROW.Change, [cellOf(ra + src.startA, src.a[ra] ?? ""), cellOf(ab + src.startB, src.b[ab] ?? "")], src.maxWordTokens));
	}
	return rows;
};

/** The one-sided tail of a change run: extra removes, then extra adds. */
const oneSidedRows = (removes: readonly Op[], adds: readonly Op[], src: RowSource): LineRow[] => {
	const rows: LineRow[] = [];
	const paired = Math.min(removes.length, adds.length);
	for (let n = paired; n < removes.length; n += 1) {
		const ra = removes[n]?.a ?? 0;
		rows.push(buildRow(ROW.Remove, [cellOf(ra + src.startA, src.a[ra] ?? ""), null], src.maxWordTokens));
	}
	for (let n = paired; n < adds.length; n += 1) {
		const ab = adds[n]?.b ?? 0;
		rows.push(buildRow(ROW.Add, [null, cellOf(ab + src.startB, src.b[ab] ?? "")], src.maxWordTokens));
	}
	return rows;
};

/** Collect the consecutive ops of one type starting at k; returns the new k. */
const takeRun = (ops: readonly Op[], k: number, type: Op["type"]): { run: Op[]; next: number } => {
	const run: Op[] = [];
	let at = k;
	while (at < ops.length) {
		const op = ops[at];
		if (op === undefined || op.type !== type) break;
		run.push(op);
		at += 1;
	}
	return { run, next: at };
};

const toRows = (ops: readonly Op[], src: RowSource): LineRow[] => {
	const rows: LineRow[] = [];
	let k = 0;
	while (k < ops.length) {
		const op = ops[k];
		if (op === undefined) break;
		if (op.type === "equal") {
			rows.push(equalRow(op, src));
			k += 1;
			continue;
		}
		const removes = takeRun(ops, k, "remove");
		const adds = takeRun(ops, removes.next, "add");
		rows.push(...changedRows(removes.run, adds.run, src), ...oneSidedRows(removes.run, adds.run, src));
		k = adds.next;
	}
	return rows;
};

/** One equal run: kept whole when short, else context + a fold + context. */
const foldRun = (run: readonly LineRow[], context: number): LineRow[] => {
	if (run.length <= context * 2 + 1) return [...run];
	return [...run.slice(0, context), { type: ROW.Fold, cells: [], rows: run.slice(context, run.length - context) }, ...run.slice(run.length - context)];
};

const foldEqualRuns = (rows: readonly LineRow[], context: number): LineRow[] => {
	const out: LineRow[] = [];
	let k = 0;
	while (k < rows.length) {
		const row = rows[k];
		if (!row || row.type !== ROW.Equal) {
			if (row) out.push(row);
			k += 1;
			continue;
		}
		let end = k;
		while (end < rows.length && rows[end]?.type === ROW.Equal) end += 1;
		out.push(...foldRun(rows.slice(k, end), context));
		k = end;
	}
	return out;
};

const countRows = (rows: readonly LineRow[]): Record<RowType, number> => {
	const counts: Record<RowType, number> = { equal: 0, change: 0, add: 0, remove: 0, fold: 0 };
	for (const row of rows) counts[row.type] = (counts[row.type] ?? 0) + 1;
	return counts;
};

export const diffLines = (first: Span, second: Span, options: DiffOptions = {}): { rows: readonly LineRow[]; counts: Record<RowType, number> } => {
	const src: RowSource = { a: first.lines, b: second.lines, startA: first.startLine, startB: second.startLine, maxWordTokens: options.maxWordTokens ?? DIFF.MaxWordTokens };
	const rows = toRows(lcsOps(first.lines, second.lines), src);
	return { rows: foldEqualRuns(rows, options.context ?? DIFF.Context), counts: countRows(rows) };
};
