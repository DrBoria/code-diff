/**
 * Pure window arithmetic for the virtual list: prefix-summed row heights and
 * the binary search that finds the first/last slot inside the viewport (plus
 * overscan headroom). No DOM, no React — the hook feeds it real measurements.
 */
export interface VirtualRange {
	readonly start: number;
	readonly end: number;
}

/** Prefix sums of the measured heights (fallback rowHeight per unmeasured slot). */
export const prefixSums = (count: number, heights: ReadonlyMap<number, number>, rowHeight: number): number[] => {
	const sums: number[] = new Array(count + 1);
	sums[0] = 0;
	for (let i = 0; i < count; i += 1) sums[i + 1] = (sums[i] ?? 0) + (heights.get(i) ?? rowHeight);
	return sums;
};

/** The first slot whose bottom is below (top - headroom). */
const firstAt = (sums: readonly number[], count: number, limit: number): number => {
	let lo = 0;
	let hi = count;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if ((sums[mid + 1] ?? 0) <= limit) lo = mid + 1;
		else hi = mid;
	}
	return Math.max(0, lo);
};

export interface WindowArgs {
	readonly sums: readonly number[];
	readonly count: number;
	readonly top: number;
	readonly height: number;
	readonly headroom: number;
}

/** The window of slots visible between top and top+height, grown by headroom. */
export const windowOf = ({ sums, count, top, height, headroom }: WindowArgs): VirtualRange => {
	const first = firstAt(sums, count, top - headroom);
	let last = first;
	while (last < count && (sums[last] ?? 0) < top + height + headroom) last += 1;
	return { start: first, end: Math.max(last, Math.min(count, first + 1)) };
};
