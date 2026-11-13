import type { Arc, Column, ItemId, NodeRef } from "../interface/types.js";

/**
 * ── EDGES ───────────────────────────────────────────────────────────────────
 *
 * A graph column draws the edges that stay inside it and hands the rest out as
 * links, so "points at another column" has exactly one meaning in the package.
 * There is one reader, `edgesOf`, and no second copy of the rule anywhere else.
 */

const refOf = (ref: NodeRef | ItemId): NodeRef => (typeof ref === "object" ? ref : { node: ref });

export interface EdgeEnds {
	readonly from: NodeRef;
	readonly to: NodeRef;
}

export const endsOf = (item: Arc): EdgeEnds => ({ from: refOf(item.from), to: refOf(item.to) });

/** True when both ends live in this column — the edge is drawn as an arrow. */
export const staysInside = (item: Arc, columnId: string): boolean => {
	const { from, to } = endsOf(item);

	return (from.column ?? columnId) === columnId && (to.column ?? columnId) === columnId;
};

/** The edges of a column, split once: inner ones are arrows, outer ones are links. */
export const edgesOf = <Data,>(column: Column<Data>): { inner: Arc[]; outer: Arc[] } => {
	const all = column.arcs ?? [];

	return {
		inner: all.filter((item) => staysInside(item, column.id)),
		outer: all.filter((item) => !staysInside(item, column.id)),
	};
};
