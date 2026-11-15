import type { Ribbon, MeasuredRibbon } from "./ribbon-types.js";
import { measureRibbon } from "./ribbon-measure.js";
import { positionRibbons, type Positioned } from "./hooks/use-ribbon-position.js";
import { bandPaths, groupHintPath } from "./ribbon-svg.js";
import type { RibbonContext } from "./ribbon-context.js";

/**
 * The backdrop scene, assembled from pure pieces: measure every ribbon against
 * the live layout, allocate corridor slots, then write the row washes (with the
 * hovered group's weaker hints). No React — the paint hook only commits this.
 */
export interface Scene {
	readonly measured: readonly Positioned[];
	readonly bands: SVGElement[];
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

export const sceneOf = (ctx: RibbonContext): Scene => {
	const measured = placeAll(ctx);
	const hotChain = ctx.hotRibbon === null ? null : (measured.find((m) => m.ribbon.id === ctx.hotRibbon) ?? null);
	const hotKeys = hotChain === null ? new Set<string>() : chainKeys(hotChain.ribbon);

	const bands = bandPaths(measured, ctx.columnBoxes, ctx.tone, ctx.hotRibbon);
	for (const key of ctx.hotRows) {
		if (hotKeys.has(key)) continue;
		const hint = groupHintPath(ctx, key);
		if (hint !== null) bands.push(hint);
	}
	return { measured, bands };
};
