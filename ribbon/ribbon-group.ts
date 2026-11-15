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

export const buildConnections = (rows: readonly RowLink[], caption?: BandCaption): readonly Ribbon[] => {
	const runs: { from: number; to: number; group: string; tone: string }[] = [];
	let current: { from: number; to: number; group: string; tone: string } | null = null;
	rows.forEach((row, index) => {
		const tone = row.tone ?? "duplicate";
		if (row.group !== null) {
			if (current !== null && current.group === row.group) {
				current.to = index;
				if (tone === "differs" || tone === "unique") current.tone = tone;
				return;
			}
			current = { from: index, to: index, group: row.group, tone };
			runs.push(current);
			return;
		}
		if (row.extend === true && current !== null) {
			current.to = index;
			if (tone === "differs" || tone === "unique") current.tone = tone;
			return;
		}
		current = null;
	});
	const ribbons: Ribbon[] = [];
	for (const run of runs) {
		const ends = new Map<string, RowId[]>();
		for (let index = run.from; index <= run.to; index += 1) {
			const cells = rows[index]?.cells ?? {};
			for (const [column, id] of Object.entries(cells)) {
				const list = ends.get(column) ?? [];
				if (!list.includes(id)) list.push(id);
				ends.set(column, list);
			}
		}
		if (ends.size === 0) continue;
		const ribbonEnds: RibbonEnd[] = [...ends.entries()].map(([column, rows]) => ({ column, rows }));
		const label = caption?.(run.from, run.to);
		ribbons.push({ id: `link-${run.from}`, tone: run.tone, ends: ribbonEnds, ...(label === undefined || label === null ? {} : { label }) });
	}
	return ribbons;
};
