import { useLayoutEffect, type RefObject } from "react";

/**
 * The ONE wiring of "an element changed": its size (ResizeObserver, optionally
 * over matching descendants) and its scroll, both answered by the same
 * callback. Every feature that reacts to the DOM — measuring anchors, windowing
 * rows — shares this lifecycle, so observer bugs are fixed in one place.
 */
export interface DomObserverArgs {
	readonly root: RefObject<HTMLElement | null>;
	readonly onChange: () => void;
	/** Observe these descendants too (CSS selector); absent = the root only. */
	readonly selector?: string;
	/** Also listen for scroll on the element itself. */
	readonly scroll?: boolean;
}

export const useDomObserver = ({ root, onChange, selector, scroll = false }: DomObserverArgs): void => {
	useLayoutEffect(() => {
		const element = root.current;
		if (element === null) return undefined;
		const observer = new ResizeObserver(onChange);
		observer.observe(element);
		if (selector !== undefined) for (const child of element.querySelectorAll(selector)) observer.observe(child);
		if (scroll) element.addEventListener("scroll", onChange, { passive: true });
		return () => {
			observer.disconnect();
			if (scroll) element.removeEventListener("scroll", onChange);
		};
	}, [root, onChange, selector, scroll]);
};
