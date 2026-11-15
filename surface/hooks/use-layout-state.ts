import { useCallback, useRef, useState, type RefObject } from "react";
import type { SurfaceLayout } from "../surface-types.js";
import { measureLayout } from "../surface-measure.js";
import { commitLayout } from "../layout-commit.js";

/**
 * The committed layout of the backdrop: measure the live element, then accept
 * the measurement only when its fingerprint changed (layout-commit). The
 * revision counter is what the imperative paint watches.
 */
export interface LayoutState {
	readonly layout: SurfaceLayout | null;
	readonly revision: number;
	readonly measure: () => void;
}

export const useLayoutState = (root: RefObject<HTMLDivElement | null>, gap: number): LayoutState => {
	const [layout, setLayout] = useState<SurfaceLayout | null>(null);
	const [revision, setRevision] = useState(0);
	const lastKey = useRef("");
	const bump = useCallback(() => setRevision((r) => r + 1), []);
	const measure = useCallback((): void => {
		if (root.current !== null) commitLayout(measureLayout(root.current, gap), { lastKey, setLayout, bump });
	}, [root, gap, bump]);
	return { layout, revision, measure };
};
