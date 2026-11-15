import { useMemo } from "react";
import type { Column } from "../../columns/column-types.js";

/**
 * Group highlighting is a COLUMN + ROW behaviour: a row carries a `group` key,
 * and hovering any row of a group lights every row of that group across every
 * column that names it. No separate "block" entity is needed — the column maps
 * group → rows, and the row's group key is the whole contract.
 */
export interface RowGroups {
	/** group key → row keys (column::id) across all columns. */
	readonly byGroup: ReadonlyMap<string, ReadonlySet<string>>;
	/** row key → its group key. */
	readonly groupOf: ReadonlyMap<string, string>;
}

export const useRowGroups = (columns: readonly Column[]): RowGroups =>
	useMemo(() => {
		const byGroup = new Map<string, Set<string>>();
		const groupOf = new Map<string, string>();
		for (const column of columns) {
			for (const row of column.rows ?? []) {
				if (row.group === undefined) continue;
				const key = `${column.id}::${String(row.id)}`;
				groupOf.set(key, row.group);
				const set = byGroup.get(row.group) ?? new Set<string>();
				set.add(key);
				byGroup.set(row.group, set);
			}
		}
		return { byGroup, groupOf };
	}, [columns]);
