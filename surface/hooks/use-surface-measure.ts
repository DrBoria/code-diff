import { useLayoutEffect, type RefObject } from "react";
import { useLayoutState, type LayoutState } from "./use-layout-state.js";
import { useDomObserver } from "./use-dom-observer.js";
import { settleMeasure } from "../surface-settle.js";

/**
 * The lifecycle of the backdrop measurement: measure on mount, on every
 * size/content change (the shared DOM observer), and once the frame settles
 * after a fold/reveal. The measurement is pure (surface-measure) and the
 * commit is fingerprinted (use-layout-state); this hook only wires them.
 */
export { measureLayout, readScrollTops, layoutLookup, layoutColumn } from "../surface-measure.js";

export type SurfaceMeasure = LayoutState;

export const useSurfaceMeasure = (root: RefObject<HTMLDivElement | null>, gap: number, settleKey: string): SurfaceMeasure => {
	const state = useLayoutState(root, gap);

	useDomObserver({ root, selector: "[data-column]", onChange: state.measure });

	useLayoutEffect(() => {
		if (root.current === null) return undefined;
		state.measure();
		return settleMeasure(state.measure);
	}, [root, state.measure, settleKey]);

	return state;
};
