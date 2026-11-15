import type { Column } from "../columns/column-types.js";
import type { Ribbon, MeasuredRibbon } from "./ribbon-types.js";
import type { SurfaceLayout, AnchorLookup } from "../surface/surface-types.js";
import { layoutColumn, layoutLookup, readScrollTops } from "../surface/hooks/use-surface-measure.js";
import { measureRibbon, type RibbonColumnBox } from "./ribbon-measure.js";

/**
 * The pure geometry of every ribbon against a measured layout + scroll: the
 * column boxes, the anchor lookup, and each ribbon's measured shape. No React —
 * the hook memoizes this against the layout, so a fold/reveal/resize re-measures
 * and a ribbon can never keep stale boxes pointing into empty space.
 */
export interface RibbonGeometry {
	readonly measured: readonly { ribbon: Ribbon; shape: MeasuredRibbon }[];
	readonly columns: readonly RibbonColumnBox[];
	readonly lookup: AnchorLookup;
}

export interface GeometryArgs {
	readonly ribbons: readonly Ribbon[];
	readonly columns: readonly Column[];
	readonly layout: SurfaceLayout | null;
	readonly root: HTMLElement | null;
	readonly rowHeight: number;
}

export const geometryOf = ({ ribbons, columns, layout, root, rowHeight }: GeometryArgs): RibbonGeometry => {
	const scrollTops = root === null ? new Map<string, number>() : readScrollTops(root);
	const lookup = layoutLookup(layout, scrollTops);
	const columnBoxes: RibbonColumnBox[] = columns.map((c) => ({ id: c.id, box: layoutColumn(layout, c.id) }));
	const measured: { ribbon: Ribbon; shape: MeasuredRibbon }[] = [];
	for (const ribbon of ribbons) {
		const shape = measureRibbon({ ribbon, columns: columnBoxes, lookup, rowHeight });
		if (shape !== null) measured.push({ ribbon, shape });
	}
	return { measured, columns: columnBoxes, lookup };
};
