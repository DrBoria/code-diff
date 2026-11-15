/**
 * ── ROWS OF A COMPARISON ──────────────────────────────────────────────────
 *
 * Aligns two texts into rows (LCS over lines), and inside a changed row an LCS
 * over tokens so only the differing identifier is marked. A row holds one cell
 * per column — never left/right. Long equal runs are folded with context kept.
 */

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

interface Op {
	readonly type: "equal" | "add" | "remove";
	readonly a?: number;
	readonly b?: number;
}

const lcsOps = (a: readonly string[], b: readonly string[]): Op[] => {
	const rows = a.length + 1;
	const cols = b.length + 1;
	const table = new Uint16Array(rows * cols);
	for (let i = 1; i < rows; i += 1)
		for (let j = 1; j < cols; j += 1)
			table[i * cols + j] = a[i - 1] === b[j - 1] ? (table[(i - 1) * cols + (j - 1)] ?? 0) + 1 : Math.max(table[(i - 1) * cols + j] ?? 0, table[i * cols + (j - 1)] ?? 0);
	const ops: Op[] = [];
	let i = a.length;
	let j = b.length;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
			ops.push({ type: "equal", a: i - 1, b: j - 1 });
			i -= 1;
			j -= 1;
		} else if (j > 0 && (i === 0 || (table[i * cols + (j - 1)] ?? 0) >= (table[(i - 1) * cols + j] ?? 0))) {
			ops.push({ type: "add", b: j - 1 });
			j -= 1;
		} else {
			ops.push({ type: "remove", a: i - 1 });
			i -= 1;
		}
	}
	return ops.reverse();
};

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
		if (op.type === "equal") {
			push(firstRuns, a[op.a ?? 0] ?? "", false);
			push(secondRuns, b[op.b ?? 0] ?? "", false);
		} else if (op.type === "remove") push(firstRuns, a[op.a ?? 0] ?? "", true);
		else push(secondRuns, b[op.b ?? 0] ?? "", true);
	}
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

const toRows = (ops: readonly Op[], a: readonly string[], b: readonly string[], startA: number, startB: number, maxWordTokens: number): LineRow[] => {
	const rows: LineRow[] = [];
	let k = 0;
	while (k < ops.length) {
		const op = ops[k] ?? { type: "equal" };
		if (op.type === "equal") {
			rows.push(buildRow(ROW.Equal, [cellOf((op.a ?? 0) + startA, a[op.a ?? 0] ?? ""), cellOf((op.b ?? 0) + startB, b[op.b ?? 0] ?? "")], maxWordTokens));
			k += 1;
			continue;
		}
		const removes: Op[] = [];
		const adds: Op[] = [];
		while (k < ops.length && ops[k]?.type === "remove") removes.push(ops[k++] as Op);
		while (k < ops.length && ops[k]?.type === "add") adds.push(ops[k++] as Op);
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
	for (const row of rows) counts[row.type] = (counts[row.type] ?? 0) + 1;
	return counts;
};

export const diffLines = (first: Span, second: Span, options: DiffOptions = {}): { rows: readonly LineRow[]; counts: Record<RowType, number> } => {
	const rows = toRows(lcsOps(first.lines, second.lines), first.lines, second.lines, first.startLine, second.startLine, options.maxWordTokens ?? DIFF.MaxWordTokens);
	return { rows: foldEqualRuns(rows, options.context ?? DIFF.Context), counts: countRows(rows) };
};
