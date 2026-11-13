import type { Connection, ConnectionEnd, ItemId } from "../interface/types.js";

/**
 * Row-level band grouping, in the package so the owner only states FACTS.
 *
 * The owner says, per row: which cell id it carries in each column, whether the
 * row belongs to a band and with which group key, and whether it only extends the
 * open band (a folded row, which carries no cells). This module turns that into
 * `Connection`s: consecutive rows with the same group key become ONE connection,
 * its ends collapse the cells of every column, and `tone` is `differs` if any row
 * of the band is. No column is special — "0", "1", …, N all behave the same.
 */
export interface RowLink {
	/** Consecutive rows with the same non-null key form one connection. */
	readonly group: string | null;
	/** Extend the OPEN connection without starting a new one (a folded row). */
	readonly extend?: boolean;
	/** The tone a row contributes; `differs` wins over the whole band. */
	readonly tone?: string;
	/** Column id → the item id this row holds in that column. */
	readonly cells: Readonly<Record<string, ItemId>>;
}

/** The caption of a band, computed from the real span it covers. */
export type BandCaption = (from: number, to: number) => string | null | undefined;

interface Run {
	from: number;
	to: number;
	group: string;
	tone: string;
}

export const buildConnections = (rows: readonly RowLink[], caption?: BandCaption): readonly Connection[] => {
	const runs: Run[] = [];
	let current: Run | null = null;

	rows.forEach((row, index) => {
		const tone = row.tone ?? "same";

		if (row.group !== null) {
			if (current !== null && current.group === row.group) {
				current.to = index;
				if (tone === "differs") current.tone = "differs";

				return;
			}

			const run: Run = { from: index, to: index, group: row.group, tone };
			runs.push(run);
			current = run;

			return;
		}

		// A folded row only extends an OPEN band; alone it starts nothing.
		if (row.extend === true && current !== null) {
			current.to = index;
			if (tone === "differs") current.tone = "differs";

			return;
		}

		current = null;
	});

	const connections: Connection[] = [];

	for (const run of runs) {
		const ends = new Map<string, ItemId[]>();

		for (let index = run.from; index <= run.to; index += 1) {
			const cells = rows[index]?.cells ?? {};
			for (const [column, id] of Object.entries(cells)) {
				const list = ends.get(column) ?? [];
				if (!list.includes(id)) list.push(id);
				ends.set(column, list);
			}
		}

		// A band that holds no row of any column is not a connection.
		if (ends.size === 0) continue;

		const link: { id: string; tone: string; label?: string; ends: ConnectionEnd[] } = {
			id: `link-${run.from}`,
			tone: run.tone,
			ends: [...ends.entries()].map(([column, items]) => ({ column, items })),
		};
		const label = caption?.(run.from, run.to);
		if (label !== undefined && label !== null) link.label = label;

		connections.push(link);
	}

	return connections;
};
