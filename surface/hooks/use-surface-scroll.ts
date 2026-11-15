import { useLayoutEffect, type RefObject } from "react";
import type { SyncGroup } from "../../columns/column-types.js";
import { wireSync } from "../sync-scroll.js";

/**
 * Scroll behaviour of the backdrop: repaint on scroll (no re-measure), and tie
 * explicit groups of columns together per requested axis (sync-scroll wires
 * them; this hook only owns the lifecycle).
 */

/** Repaint callback on any pane scroll, coalesced to one per frame. */
export const useScrollRepaint = (root: RefObject<HTMLDivElement | null>, repaint: () => void): void => {
	useLayoutEffect(() => {
		const element = root.current;
		if (!element) return undefined;
		let frame = 0;
		const onScroll = (): void => {
			if (frame !== 0) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				repaint();
			});
		};
		element.addEventListener("scroll", onScroll, { passive: true, capture: true });
		return () => {
			element.removeEventListener("scroll", onScroll, { capture: true });
			if (frame !== 0) cancelAnimationFrame(frame);
		};
	}, [root, repaint]);
};

/** Tie every pane in a group to whichever pane moved, per requested axis. */
export const useSyncedScroll = (root: RefObject<HTMLDivElement | null>, sync: readonly SyncGroup[]): void => {
	useLayoutEffect(() => {
		const element = root.current;
		if (element === null) return undefined;
		return wireSync(element, sync);
	}, [root, sync]);
};
