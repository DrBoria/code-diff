import type { Ribbon, MeasuredRibbon } from "./ribbon-types.js";
import { measureRibbon } from "./ribbon-measure.js";
import { positionRibbons, type Positioned } from "./hooks/use-ribbon-position.js";
import { bandPath, groupHintPath } from "./ribbon-svg.js";
import type { RibbonContext } from "./ribbon-context.js";

/**
 * The backdrop scene, assembled from pure pieces: measure every ribbon against
 * the live layout and allocate corridor slots. THE CONTRACT: a ribbon is one
 * continuous strip — its CHAIN rows carry row-height bands in the ribbon's own
 * shade (hot = one uniform hot shade for bands AND road); a hovered group
 * header adds row-height hint strips for its members. Rows outside any chain
 * are NEVER washed. No React — the paint hook only commits this.
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

/** One ribbon's chain bands: every end row, in the ribbon's ONE shade (hot
 *  chains paint bands and road in the same hot colour). */
const chainBands = (ctx: RibbonContext, entry: Positioned): SVGElement[] => {
	const fill = ctx.hotRibbon === entry.ribbon.id ? ctx.tone.hotOf(entry.ribbon) : ctx.tone.fillOf(entry.ribbon);
	return entry.shape.bands.flatMap((band) =>
		band.rows
			.map((id) => bandPath(ctx, band, fill, `${band.column}::${String(id)}`))
			.filter((path): path is SVGElement => path !== null),
	);
};

/** A hovered group header's member hints — row-height strips, never over the
 *  hot chain's own rows (those already carry the chain's bands). */
const hintBands = (ctx: RibbonContext, hotKeys: ReadonlySet<string>): SVGElement[] =>
	[...ctx.hotRows]
		.filter((key) => !hotKeys.has(key))
		.map((key) => groupHintPath(ctx, key))
		.filter((path): path is SVGElement => path !== null);

export const sceneOf = (ctx: RibbonContext): Scene => {
	const measured = placeAll(ctx);
	const hotChain = ctx.hotRibbon === null ? null : (measured.find((m) => m.ribbon.id === ctx.hotRibbon) ?? null);
	const hotKeys = hotChain === null ? new Set<string>() : chainKeys(hotChain.ribbon);
	const bands = [...measured.flatMap((entry) => chainBands(ctx, entry)), ...hintBands(ctx, hotKeys)];
	return { measured, bands };
};
