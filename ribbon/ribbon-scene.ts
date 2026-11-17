import type { Ribbon, MeasuredRibbon } from "./ribbon-types.js";
import { measureRibbon } from "./ribbon-measure.js";
import { positionRibbons, type Positioned } from "./hooks/use-ribbon-position.js";
import { groupHintPath } from "./ribbon-svg.js";
import type { RibbonContext } from "./ribbon-context.js";

/**
 * The backdrop scene: measure every ribbon against the live layout and
 * allocate corridor slots. A ribbon is ONE entity — its single path covers
 * its rows and the corridor; there are no separate band elements. A hovered
 * group header adds corridor hint lanes. No React — the paint hook commits.
 */
export interface Scene {
	readonly measured: readonly Positioned[];
	readonly hints: SVGElement[];
}

/** The row keys a ribbon's ends name. */
const chainKeys = (ribbon: Ribbon): Set<string> => {
	const keys = new Set<string>();
	for (const end of ribbon.ends ?? []) for (const id of end.rows ?? []) keys.add(`${end.column}::${String(id)}`);
	return keys;
};

/** Measure every ribbon, then allocate one corridor slot per lane. */
const placeAll = (ctx: RibbonContext): Positioned[] => {
	const natural: { ribbon: Ribbon; shape: MeasuredRibbon }[] = [];
	for (const ribbon of ctx.ribbons) {
		const shape = measureRibbon({ ribbon, columns: ctx.columnBoxes, lookup: ctx.lookup, rowHeight: ctx.rowHeight });
		if (shape !== null) natural.push({ ribbon, shape });
	}
	// ONE LANE, ONE SLOT: crowded corridors shift a lane's waist (and its
	// caption) down between rows; ends never leave their rows.
	return positionRibbons(natural, ctx.columnBoxes, (ribbon, shift) => measureRibbon({ ribbon, columns: ctx.columnBoxes, lookup: ctx.lookup, rowHeight: ctx.rowHeight, shift }));
};

/** A hovered group header's member hints — corridor lanes, never over the
 *  hot chain's own rows (the hot ribbon already covers them). */
const hintLanes = (ctx: RibbonContext, hotKeys: ReadonlySet<string>): SVGElement[] =>
	[...ctx.hotRows]
		.filter((key) => !hotKeys.has(key))
		.map((key) => groupHintPath(ctx, key))
		.filter((path): path is SVGElement => path !== null);

export const sceneOf = (ctx: RibbonContext): Scene => {
	const measured = placeAll(ctx);
	const hotChain = ctx.hotRibbon === null ? null : (measured.find((m) => m.ribbon.id === ctx.hotRibbon) ?? null);
	const hotKeys = hotChain === null ? new Set<string>() : chainKeys(hotChain.ribbon);
	return { measured, hints: hintLanes(ctx, hotKeys) };
};
