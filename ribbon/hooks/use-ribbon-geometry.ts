import { useMemo } from "react";
import { geometryOf, type GeometryArgs, type RibbonGeometry } from "../ribbon-geometry.js";

/**
 * Measures every ribbon against the current layout + scroll. The geometry is
 * pure (ribbon-geometry); this hook only memoizes it against the layout, so a
 * fold/reveal/resize re-measures and a ribbon can never keep stale boxes.
 */
export type { GeometryArgs, RibbonGeometry };

export const useRibbonGeometry = (args: GeometryArgs): RibbonGeometry =>
	useMemo(() => geometryOf(args), [args.ribbons, args.columns, args.layout, args.root, args.rowHeight]);
