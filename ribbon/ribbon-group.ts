/**
 * Row-level grouping: consecutive rows with the same group key become ONE
 * ribbon, its ends collapse the cells of every column. No column is special.
 */
import type { Ribbon, RibbonEnd } from "./ribbon-types.js";
import type { RowId } from "../rows/row-types.js";

export interface RowLink {
	readonly group: string | null;
	readonly extend?: boolean;
	readonly tone?: string;
	readonly cells: Readonly<Record<string, RowId>>;
}
export type BandCaption = (from: number, to: number) => string | null | undefined;

interface Run {
	from: number;
	to: number;
	group: string;
	tone: string;
}

/** A run keeps the strongest tone it saw: differs/unique outrank duplicate. */
const toneOf = (current: string, next: string): string => (next === "differs" || next === "unique" ? next : current);

/** Consecutive same-group rows (plus extend rows) collapse into runs. */
const runsOf = (rows: readonly RowLink[]): Run[] => {
	const runs: Run[] = [];
	let current: Run | null = null;
	rows.forEach((row, index) => {
		const tone = row.tone ?? "duplicate";
		if (row.group !== null) {
			if (current !== null && current.group === row.group) {
				current.to = index;
				current.tone = toneOf(current.tone, tone);
				return;
			}
			current = { from: index, to: index, group: row.group, tone };
			runs.push(current);
			return;
		}
		if (row.extend === true && current !== null) {
			current.to = index;
			current.tone = toneOf(current.tone, tone);
			return;
		}
		current = null;
	});
	return runs;
};

/** The distinct row ids a run names, per column. */
const endsOf = (rows: readonly RowLink[], run: Run): RibbonEnd[] => {
	const ends = new Map<string, RowId[]>();
	for (let index = run.from; index <= run.to; index += 1) {
		for (const [column, id] of Object.entries(rows[index]?.cells ?? {})) {
			const list = ends.get(column) ?? [];
			if (!list.includes(id)) list.push(id);
			ends.set(column, list);
		}
	}
	return [...ends.entries()].map(([column, ids]) => ({ column, rows: ids }));
};

export const buildConnections = (rows: readonly RowLink[], caption?: BandCaption): readonly Ribbon[] => {
	const ribbons: Ribbon[] = [];
	for (const run of runsOf(rows)) {
		const ends = endsOf(rows, run);
		if (ends.length === 0) continue;
		const label = caption?.(run.from, run.to);
		ribbons.push({ id: `link-${run.from}`, tone: run.tone, ends, ...(label == null ? {} : { label }) });
	}
	return ribbons;
};
