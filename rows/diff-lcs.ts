/**
 * The LCS engine of the line/word diff: a table over two key sequences and the
 * walk back into an edit script. Pure math — no rows, no cells, no colours.
 */

export interface Op {
	readonly type: "equal" | "add" | "remove";
	readonly a?: number;
	readonly b?: number;
}

/** The LCS table over two sequences of comparable keys. */
const lcsTable = (a: readonly string[], b: readonly string[]): Uint16Array => {
	const rows = a.length + 1;
	const cols = b.length + 1;
	const table = new Uint16Array(rows * cols);
	for (let i = 1; i < rows; i += 1) {
		for (let j = 1; j < cols; j += 1) {
			table[i * cols + j] = a[i - 1] === b[j - 1] ? (table[(i - 1) * cols + (j - 1)] ?? 0) + 1 : Math.max(table[(i - 1) * cols + j] ?? 0, table[i * cols + (j - 1)] ?? 0);
		}
	}
	return table;
};

/** The walk's cursor: the table plus the current position in both sequences. */
interface Walk {
	readonly a: readonly string[];
	readonly b: readonly string[];
	readonly table: Uint16Array;
	i: number;
	j: number;
}

/** One step of the walk: a match, or the cheaper of skip-left / skip-right. */
const step = (walk: Walk): Op => {
	const { a, b, table, i, j } = walk;
	const cols = b.length + 1;
	if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) return { type: "equal", a: i - 1, b: j - 1 };
	const skipLeft = i > 0 ? (table[(i - 1) * cols + j] ?? 0) : -1;
	const skipRight = j > 0 ? (table[i * cols + (j - 1)] ?? 0) : -1;
	if (j > 0 && skipRight >= skipLeft) return { type: "add", b: j - 1 };
	return { type: "remove", a: i - 1 };
};

/** Walk the LCS table back into an edit script, in order. */
export const lcsOps = (a: readonly string[], b: readonly string[]): Op[] => {
	const walk: Walk = { a, b, table: lcsTable(a, b), i: a.length, j: b.length };
	const ops: Op[] = [];
	while (walk.i > 0 || walk.j > 0) {
		const op = step(walk);
		ops.push(op);
		if (op.type === "equal") {
			walk.i -= 1;
			walk.j -= 1;
		} else if (op.type === "add") walk.j -= 1;
		else walk.i -= 1;
	}
	return ops.reverse();
};
