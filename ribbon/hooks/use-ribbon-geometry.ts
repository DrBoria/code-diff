import { useMemo } from "react";
import type { Column } from "../../columns/column-types.js";
import type { Ribbon, MeasuredRibbon } from "../ribbon-types.js";
import type { SurfaceLayout, AnchorLookup } from "../../surface/surface-types.js";
import { layoutColumn, layoutLookup, readScrollTops } from "../../surface/hooks/use-surface-measure.js";
import { measureRibbon, type RibbonColumnBox } from "../ribbon-path.js";

/**
 * Measures every ribbon against the current layout + scroll. Re-runs whenever
 * the layout changes (which happens on every fold/reveal/resize), so a ribbon
 * can never keep stale boxes and point into empty space.
 */
export interface RibbonGeometry {
	readonly measured: readonly { ribbon: Ribbon; shape: MeasuredRibbon }[];
	readonly columns: readonly RibbonColumnBox[];
	readonly lookup: AnchorLookup;
}

export const useRibbonGeometry = (
	ribbons: readonly Ribbon[],
	columns: readonly Column[],
	layout: SurfaceLayout | null,
	root: HTMLElement | null,
	rowHeight: number,
): RibbonGeometry => {
	const scrollTops = useMemo(() => (root === null ? new Map<string, number>() : readScrollTops(root)), [root, layout]);
	const lookup = useMemo(() => layoutLookup(layout, scrollTops), [layout, scrollTops]);
	const columnBoxes = useMemo<RibbonColumnBox[]>(() => columns.map((c) => ({ id: c.id, box: layoutColumn(layout, c.id) })), [columns, layout]);
	const measured = useMemo(() => {
		const out: { ribbon: Ribbon; shape: MeasuredRibbon }[] = [];
		for (const ribbon of ribbons) {
			const shape = measureRibbon(ribbon, columnBoxes, lookup, rowHeight);
			if (shape !== null) out.push({ ribbon, shape });
		}
		return out;
	}, [ribbons, columnBoxes, lookup, rowHeight]);
	return { measured, columns: columnBoxes, lookup };
};
