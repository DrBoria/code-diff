/**
 * Real three-way merge state for the demo. The result column is computed from
 * per-hunk decisions (left / right / both / base), so applying an action genuinely
 * re-renders the centre column. Undo restores the previous decision set.
 */
import type { Column, Row, Ribbon } from "../index.js";

export type Decision = "base" | "left" | "right" | "both";

export interface MergeHunk {
	readonly id: string;
	readonly base: string;
	readonly left: string;
	readonly right: string;
}

export const MERGE_HUNKS: readonly MergeHunk[] = [
	{ id: "timeout", base: "const timeout = 30;", left: "const timeout = 60;", right: "const timeout = 30;" },
	{ id: "retry", base: "retry = true;", left: "retry = true;", right: "retry = false;" },
	{ id: "log", base: "log(level);", left: "log(level);", right: "log(level, ctx);" },
	{ id: "cache", base: "cache = null;", left: "cache = new Map();", right: "cache = null;" },
];

export type Decisions = Readonly<Record<string, Decision>>;

export const initialDecisions = (): Decisions => Object.fromEntries(MERGE_HUNKS.map((h) => [h.id, "base" as Decision]));

const resultLines = (hunk: MergeHunk, decision: Decision): string[] => {
	switch (decision) {
		case "left":
			return [hunk.left];
		case "right":
			return [hunk.right];
		case "both":
			return [hunk.left, hunk.right];
		default:
			return [hunk.base];
	}
};

/** Build the three columns + the result column + ribbons from the decisions. */
export const mergeBoard = (decisions: Decisions): { columns: Column[]; ribbons: Ribbon[] } => {
	const base: Row[] = [];
	const left: Row[] = [];
	const right: Row[] = [];
	const result: Row[] = [];
	const ribbons: Ribbon[] = [];
	MERGE_HUNKS.forEach((hunk, i) => {
		const id = String(i + 1);
		const decision = decisions[hunk.id] ?? "base";
		const tone = decision === "base" ? "duplicate" : decision === "both" ? "conflict" : "changed";
		base.push({ id, plate: id, text: hunk.base, tone: "duplicate" });
		left.push({ id, plate: id, text: hunk.left, tone: hunk.left === hunk.base ? "duplicate" : "changed" });
		right.push({ id, plate: id, text: hunk.right, tone: hunk.right === hunk.base ? "duplicate" : "changed" });
		const lines = resultLines(hunk, decision);
		lines.forEach((line, j) => result.push({ id: `${id}-${j}`, plate: String(result.length + 1), text: line, tone }));
		ribbons.push({
			id: hunk.id,
			tone,
			label: hunk.id,
			ends: [
				{ column: "left", rows: [id] },
				{ column: "result", rows: lines.map((_, j) => `${id}-${j}`) },
				{ column: "right", rows: [id] },
			],
		});
	});
	const columns: Column[] = [
		{ id: "left", title: "ours", rows: left, ratio: 1, mirrored: true },
		{ id: "result", title: "result", rows: result, ratio: 1 },
		{ id: "right", title: "theirs", rows: right, ratio: 1 },
	];
	return { columns, ribbons };
};
