import type { BoardConfig, ResolvedConfig } from "./board/board-types.js";

/**
 * ── CONFIG ─────────────────────────────────────────────────────────────────
 *
 * ONE place that parses the owner's config into a complete, resolved set. Every
 * feature reads its knobs from here (via context), and the ribbon receives its
 * paint colours from the resolved theme — never from a private constant.
 */

export const DEFAULT_CONFIG: ResolvedConfig = {
	rowHeight: 18,
	bandGap: 1,
	diffContext: 3,
	maxWordTokens: 400,
	fullMount: 400,
	overscan: 1,
	maxHeight: "70vh",
	foldUnconnected: true,
	ribbonHeight: 1,
	foldLabel: (count) => `⋯ ${count} line${count === 1 ? "" : "s"} hidden — click to show`,
};

export const resolveConfig = (config?: BoardConfig): ResolvedConfig => ({
	...DEFAULT_CONFIG,
	...(config ?? {}),
	foldLabel: config?.foldLabel ?? DEFAULT_CONFIG.foldLabel,
});
