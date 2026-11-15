import { useMemo } from "react";
import type { Column, ConnectedMap } from "../../columns/column-types.js";
import type { Row, RowId } from "../row-types.js";

/**
 * Folding is a ROW behaviour, not a separate entity: rows that take part in no
 * ribbon are hidden and collapsed into a single row carrying `hiddenCount` and
 * the ids it hides. Show/hide are ordinary row actions. A column may opt out
 * (`fold: false`) or the board may turn folding off for everyone.
 */

/** One display slot: a real row, or a folded run of hidden rows. */
export type RowSlot = { kind: "row"; row: Row; index: number } | { kind: "fold"; count: number; ids: readonly RowId[]; index: number };

export const useRowFold = (column: Column, connected: ReadonlySet<RowId> | undefined, revealed: boolean, foldEnabled: boolean): readonly RowSlot[] =>
	useMemo(() => {
		const rows = column.rows ?? [];
		const foldHere = foldEnabled && (column.fold ?? true);
		const shown = (row: Row): boolean => revealed || !foldHere || connected === undefined || connected.has(row.id);
		const slots: RowSlot[] = [];
		let hidden: RowId[] = [];
		const flush = (index: number): void => {
			if (hidden.length === 0) return;
			slots.push({ kind: "fold", count: hidden.length, ids: hidden, index });
			hidden = [];
		};
		rows.forEach((row, index) => {
			if (!shown(row)) {
				hidden.push(row.id);
				return;
			}
			flush(index);
			slots.push({ kind: "row", row, index });
		});
		flush(rows.length);
		return slots;
	}, [column, connected, revealed, foldEnabled]);

/** Which row ids per column take part in at least one ribbon. */
export const connectedMapOf = (_columns: readonly Column[], ribbonEnds: readonly { column: string; rows: readonly RowId[] }[]): ConnectedMap => {
	const map = new Map<string, Set<RowId>>();
	for (const end of ribbonEnds) {
		const set = map.get(end.column) ?? new Set<RowId>();
		for (const id of end.rows) set.add(id);
		map.set(end.column, set);
	}
	return map;
};
