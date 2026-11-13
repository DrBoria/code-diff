import type { AnchorId, Column, Item, ItemId } from "../interface/types.js";

/**
 * A column is a NAME and a list of things to draw. Nothing else: `kind` picks a
 * renderer, and the items carry whatever the owner wants them to carry.
 */
export const column = <Data>(spec: Column<Data>): Column<Data> => {
	if (!spec.id) throw new Error("columns-view: a column needs an id");

	return { items: [], arcs: [], ...spec };
};

/**
 * One entry of a column. Its ADDRESS is its id: a connection names ids, and the
 * board measures the element that carries the same id. `anchor` exists only for
 * the case where two items must share one address.
 */
export const item = <Data>(spec: { id: ItemId; anchor?: AnchorId; data?: Data }): Item<Data> => ({
	...spec,
	anchor: spec.anchor ?? String(spec.id),
});

export const anchorOf = <Data>(it: Item<Data>): AnchorId => it.anchor ?? String(it.id);
