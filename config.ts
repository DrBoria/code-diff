// ── BOARD CONFIG ───────────────────────────────────────────────────────────
//
// The display knobs, with their defaults in ONE place. The owner overrides any of
// them through `ViewProps.options`; nothing here is a closed constant the owner
// cannot reach. `resolveOptions` fills the gaps so every consumer reads a complete
// set without each re-declaring the defaults.

import type { BoardOptions } from "./interface/types.js";

export interface ResolvedOptions {
	readonly rowHeight: number;
	readonly bandGap: number;
	readonly diffContext: number;
	readonly maxWordTokens: number;
	readonly fullMount: number;
	readonly overscan: number;
	readonly hubLanes: number;
	readonly maxHeight: string;
	/**
	 * A fixed height for the whole board (a CSS length). When set, every column
	 * scrolls inside it and the board never grows past it — so a long file stays
	 * reachable in a bounded, scrollable region instead of stretching the page.
	 * Absent = the board is as tall as its tallest column (capped by `maxHeight`).
	 */
	readonly boardHeight?: string;
	readonly foldUnconnected: boolean;
	readonly foldLabel?: (count: number) => string;
}

export const DEFAULT_OPTIONS: ResolvedOptions = {
	rowHeight: 18,
	bandGap: 1,
	diffContext: 3,
	maxWordTokens: 400,
	fullMount: 400,
	overscan: 1,
	hubLanes: 3,
	maxHeight: "70vh",
	foldUnconnected: true,
};

export const resolveOptions = (options?: BoardOptions): ResolvedOptions => ({ ...DEFAULT_OPTIONS, ...(options ?? {}) });