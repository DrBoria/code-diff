// ── ROWS OF A COMPARISON ──────────────────────────────────────────────────
//
// A ROW is one line of the comparison: a cell per column, `null` where that
// column has no line at that point. This module builds the rows — it maps the
// LINES of one text onto the lines of another (LCS), which is the only thing that
// needs aligning. The COLUMNS are fixed grid positions and are never aligned.
//
// Two levels, the same split a diff viewer makes:
//   LINE — an LCS over the two texts, so a moved/renamed line is a change at the
//          same row instead of a delete block plus an add block;
//   WORD — inside a changed row, an LCS over tokens, so the reader sees the ONE
//          identifier that differs instead of two fully-red lines.
//
// A row holds its cells as an ARRAY, one per column — never `left`/`right`.

import { DIFF, ROW, WORD_TOKEN_RE, type RowType } from "../constants.js";

export interface Word {
	readonly text: string;
	readonly changed: boolean;
}

export interface LineCell {
	/** 1-based line number in its own file. */
	readonly no: number;
	/** The line as text, or as changed/unchanged runs when it is a word diff. */
	readonly text?: string;
	readonly words?: readonly Word[];
}

export type { RowType };

export interface LineRow {
	readonly type: RowType;
	/** One entry per column; `null` where the line exists on one side only. */
	readonly cells: readonly (LineCell | null)[];
	/** A folded run of equal rows carries the hidden rows themselves. */
	readonly rows?: readonly LineRow[];
}

export interface Span {
	/** 1-based number of the first line of `lines`. */
	readonly startLine: number;
	readonly lines: readonly string[];
}

export interface DiffOptions {
	/** Equal lines kept at each end of a folded run. */
	readonly context?: number;
	/** Above this many tokens a changed line is not word-diffed. */
	readonly maxWordTokens?: number;
}

const splitTokens = (text: string): string[] => String(text ?? "").match(WORD_TOKEN_RE) ?? [];

interface Op {
	readonly type: (typeof ROW)["Equal"] | (typeof ROW)["Add"] | (typeof ROW)["Remove"];
	readonly a?: number;
	readonly b?: number;
}

/** Classic LCS. Bodies are tens of lines, so the O(n·m) table is the cheap one. */
const lcsOps = (a: readonly string[], b: readonly string[]): Op[] => {
	const rows = a.length + 1;
	const cols = b.length + 1;
	const table = new Uint16Array(rows * cols);
	for (let i = 1; i < rows; i += 1) {
		for (let j = 1; j < cols; j += 1) {
			table[i * cols + j] = a[i - 1] === b[j - 1] ? (table[(i - 1) * cols + (j - 1)] ?? 0) + 1 : Math.max(table[(i - 1) * cols + j] ?? 0, table[i * cols + (j - 1)] ?? 0);
		}
	}

	const ops: Op[] = [];
	let i = a.length;
	let j = b.length;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
			ops.push({ type: ROW.Equal, a: i - 1, b: j - 1 });
			i -= 1;
			j -= 1;
		} else if (j > 0 && (i === 0 || (table[i * cols + (j - 1)] ?? 0) >= (table[(i - 1) * cols + j] ?? 0))) {
			ops.push({ type: ROW.Add, b: j - 1 });
			j -= 1;
		} else {
			ops.push({ type: ROW.Remove, a: i - 1 });
			i -= 1;
		}
	}

	return ops.reverse();
};

/** One changed row as word runs, so only what differs is marked. */
export const diffWords = (first: string, second: string, maxWordTokens: number = DIFF.MaxWordTokens): readonly [readonly Word[], readonly Word[]] => {
	const a = splitTokens(first);
	const b = splitTokens(second);
	if (a.length > maxWordTokens || b.length > maxWordTokens) return [[{ text: String(first ?? ""), changed: true }], [{ text: String(second ?? ""), changed: true }]];

	const push = (out: Word[], text: string, changed: boolean): void => {
		const last = out[out.length - 1];
		if (last && last.changed === changed) out[out.length - 1] = { text: last.text + text, changed };
		else out.push({ text, changed });
	};

	const firstRuns: Word[] = [];
	const secondRuns: Word[] = [];
	for (const op of lcsOps(a, b)) {
		if (op.type === ROW.Equal) {
			push(firstRuns, a[op.a ?? 0] ?? "", false);
			push(secondRuns, b[op.b ?? 0] ?? "", false);
		} else if (op.type === ROW.Remove) push(firstRuns, a[op.a ?? 0] ?? "", true);
		else push(secondRuns, b[op.b ?? 0] ?? "", true);
	}

	return [firstRuns, secondRuns];
};

const cellOf = (no: number | null, text: string | null, words?: readonly Word[]): LineCell | null => {
	if (no == null) return null;
	if (words) return { no, words };

	return text == null ? { no } : { no, text };
};

const buildRow = (type: RowType, cells: [(LineCell | null), (LineCell | null)], maxWordTokens: number): LineRow => {
	if (type !== ROW.Change) return { type, cells };
	const first = cells[0];
	const second = cells[1];
	if (!first || !second) return { type, cells };
	const [a, b] = diffWords(first.text ?? "", second.text ?? "", maxWordTokens);

	return { type, cells: [cellOf(first.no, null, a), cellOf(second.no, null, b)] };
};

const toRows = (ops: readonly Op[], a: readonly string[], b: readonly string[], startA: number, startB: number, maxWordTokens: number): LineRow[] => {
	const rows: LineRow[] = [];
	let k = 0;
	while (k < ops.length) {
		const op = ops[k] ?? { type: ROW.Equal };
		if (op.type === ROW.Equal) {
			rows.push(buildRow(ROW.Equal, [cellOf((op.a ?? 0) + startA, a[op.a ?? 0] ?? ""), cellOf((op.b ?? 0) + startB, b[op.b ?? 0] ?? "")], maxWordTokens));
			k += 1;
			continue;
		}
		const removes: Op[] = [];
		const adds: Op[] = [];
		while (k < ops.length && ops[k]?.type === ROW.Remove) removes.push(ops[k++] as Op);
		while (k < ops.length && ops[k]?.type === ROW.Add) adds.push(ops[k++] as Op);
		const paired = Math.min(removes.length, adds.length);
		for (let n = 0; n < paired; n += 1) {
			const ra = removes[n]?.a ?? 0;
			const ab = adds[n]?.b ?? 0;
			rows.push(buildRow(ROW.Change, [cellOf(ra + startA, a[ra] ?? ""), cellOf(ab + startB, b[ab] ?? "")], maxWordTokens));
		}
		for (let n = paired; n < removes.length; n += 1) {
			const ra = removes[n]?.a ?? 0;
			rows.push(buildRow(ROW.Remove, [cellOf(ra + startA, a[ra] ?? ""), null], maxWordTokens));
		}
		for (let n = paired; n < adds.length; n += 1) {
			const ab = adds[n]?.b ?? 0;
			rows.push(buildRow(ROW.Add, [null, cellOf(ab + startB, b[ab] ?? "")], maxWordTokens));
		}
	}

	return rows;
};

/** Long runs of equal rows are folded; `context` stays visible at both ends. */
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
		const run = rows.slice(k, end);
		if (run.length <= context * 2 + 1) out.push(...run);
		else {
			out.push(...run.slice(0, context));
			out.push({ type: ROW.Fold, cells: [], rows: run.slice(context, run.length - context) });
			out.push(...run.slice(run.length - context));
		}
		k = end;
	}

	return out;
};

const countRows = (rows: readonly LineRow[]): Record<RowType, number> => {
	const counts = { [ROW.Equal]: 0, [ROW.Change]: 0, [ROW.Add]: 0, [ROW.Remove]: 0, [ROW.Fold]: 0 } as Record<RowType, number>;
	for (const row of rows) counts[row.type] += 1;

	return counts;
};

/** Align two spans into rows, with long equal runs folded. */
export const diffLines = (first: Span, second: Span, options: DiffOptions = {}): { rows: readonly LineRow[]; counts: Record<RowType, number> } => {
	const rows = toRows(
		lcsOps(first.lines, second.lines),
		first.lines,
		second.lines,
		first.startLine,
		second.startLine,
		options.maxWordTokens ?? DIFF.MaxWordTokens,
	);

	return { rows: foldEqualRuns(rows, options.context ?? DIFF.Context), counts: countRows(rows) };
};
