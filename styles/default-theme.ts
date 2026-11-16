import type { Theme } from "./theme-types.js";

/**
 * The default preset. These are VALUES, not semantics: an owner may pass green
 * for `duplicate` and the board paints green duplicates. The preset only gives a
 * sensible dark-editor look out of the box; every field is overridable via props.
 *
 * CONTRAST RULE: every wash is a DARK saturated tint — light glyph ink stays
 * readable on it (light on dark, like white on dark blue). A pale translucent
 * highlighter (light amber under light text) washed the glyphs out; the preset
 * never paints a wash lighter than the glyphs that sit on it.
 */
export const defaultTheme: Theme = {
	paper: "#1e1f22",
	panel: "#2b2d30",
	edge: "#393b40",
	text: "#dfe1e5",
	dim: "#a8adbd",
	faint: "#6f737a",
	mono: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
	paint: "rgba(120,160,255,0.4)",
	ribbon: "#8a8f98",
	shadow: "0 1px 2px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.85)",
	colors: {
		duplicate: { fill: "rgba(255,107,107,0.16)", hot: "rgba(255,107,107,0.34)", text: "rgba(255,107,107,0.85)", paint: "rgba(255,107,107,0.42)" },
		unique: { fill: "rgba(120,200,170,0.14)", hot: "rgba(120,200,170,0.32)", text: "rgba(120,200,170,0.85)", paint: "rgba(120,200,170,0.36)" },
		added: { fill: "rgba(120,200,170,0.18)", hot: "rgba(120,200,170,0.38)", text: "rgba(120,200,170,0.9)", paint: "rgba(120,200,170,0.38)" },
		removed: { fill: "rgba(255,107,107,0.18)", hot: "rgba(255,107,107,0.38)", text: "rgba(255,107,107,0.9)", paint: "rgba(255,107,107,0.42)" },
		changed: { fill: "rgba(255,193,94,0.16)", hot: "rgba(255,193,94,0.34)", text: "rgba(255,193,94,0.9)", paint: "rgba(255,193,94,0.4)" },
		conflict: { fill: "rgba(120,160,255,0.18)", hot: "rgba(120,160,255,0.38)", text: "rgba(120,160,255,0.9)", paint: "rgba(120,160,255,0.4)" },
	},
};

/** Merge an owner's partial theme over the preset (shallow per section). */
export const resolveTheme = (theme?: Partial<Theme>): Theme => ({
	...defaultTheme,
	...(theme ?? {}),
	colors: { ...defaultTheme.colors, ...(theme?.colors ?? {}) },
});
