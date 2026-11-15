import { observedHtml } from "../surface/dom.js";

/**
 * Read the REAL heights of every mounted slot of a virtual list. Each slot
 * carries its index in data-slot; the measured height feeds the prefix sums,
 * so spacers and the window never guess. Pure DOM reads — the hook decides
 * what to do with the numbers.
 */
export const readSlotHeights = (content: HTMLElement, observe: (index: number, height: number) => void): void => {
	for (const child of content.querySelectorAll("[data-slot]")) {
		const slot = observedHtml(child)?.dataset.slot;
		if (slot !== undefined) observe(Number(slot), child.getBoundingClientRect().height);
	}
};
