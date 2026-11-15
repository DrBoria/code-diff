import { windowOf, type VirtualRange } from "./virtual-window.js";

/**
 * The pure window decision of the virtual list: given the scroller's real
 * geometry and the prefix-summed heights, which slots are mounted. Full-mount
 * boards mount everything; windowed boards mount the viewport plus overscan.
 * No DOM reads beyond the element handed in, no React.
 */
export interface DecideArgs {
	readonly element: HTMLElement;
	readonly count: number;
	readonly fullMount: number;
	readonly overscan: number;
	readonly sums: readonly number[];
}

export const decideWindow = ({ element, count, fullMount, overscan, sums }: DecideArgs): VirtualRange => {
	if (count <= fullMount) return { start: 0, end: count };
	const height = element.clientHeight;
	return windowOf({ sums, count, top: element.scrollTop, height, headroom: height * overscan });
};
