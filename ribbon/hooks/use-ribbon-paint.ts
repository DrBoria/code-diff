import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { measureLayout, layoutLookup, readScrollTops, layoutColumn } from "../../surface/hooks/use-surface-measure.js";
import { sceneOf } from "../ribbon-scene.js";
import { commitScene } from "../ribbon-svg.js";
import type { RibbonContext } from "../ribbon-context.js";
import type { Theme } from "../../styles/theme-types.js";

/**
 * Imperative paint of the backdrop: the scene (ribbon-scene) decides the washes
 * and lanes; this hook only commits them to the SVG. A focused chain is painted
 * in ONE uniform hot shade everywhere — bands, connectors, captions — never
 * stacked, never partial. The live DOM is measured every paint, so a
 * reveal/fold can never leave a ribbon pointing at a stale (or empty) position.
 */
export interface RibbonPaintArgs extends Omit<RibbonContext, "columnBoxes" | "lookup"> {
	readonly root: RefObject<HTMLDivElement | null>;
	readonly layer: RefObject<SVGSVGElement | null>;
	readonly theme: Theme;
	readonly bandGap: number;
	/** Bumped whenever the content/size changes, so paint re-runs after a reveal. */
	readonly revision: number;
}

export const useRibbonPaint = ({ root, layer, columns, ribbons, tone, theme, rowHeight, bandGap, hotRibbon, hotRows, revision }: RibbonPaintArgs): (() => void) => {
	const hintLayer = useRef<SVGGElement | null>(null);
	const ribbonLayer = useRef<SVGGElement | null>(null);

	const paint = useCallback((): void => {
		const svg = layer.current;
		const element = root.current;
		if (svg === null || element === null) return;
		const layout = measureLayout(element, bandGap);
		const ctx: RibbonContext = { ribbons, columns, columnBoxes: columns.map((c) => ({ id: c.id, box: layoutColumn(layout, c.id) })), lookup: layoutLookup(layout, readScrollTops(element)), rowHeight, tone, hotRibbon, hotRows };
		const layers = commitScene({ svg, layers: { hints: hintLayer.current, ribbons: ribbonLayer.current }, scene: sceneOf(ctx), ctx, theme });
		hintLayer.current = layers.hints;
		ribbonLayer.current = layers.ribbons;
	}, [root, layer, columns, ribbons, tone, theme, rowHeight, bandGap, hotRibbon, hotRows]);

	// Paint after every commit (hover, pick, reveal) and whenever the layout
	// revision bumps. Reading the live DOM inside paint makes this race-free.
	useLayoutEffect(() => {
		paint();
	}, [paint, revision]);

	return paint;
};
