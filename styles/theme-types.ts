/**
 * ── THE THEME ──────────────────────────────────────────────────────────────
 *
 * The theme is a FEATURE: every colour the board paints with arrives through it.
 * Colours are SEMANTIC KEYS (`duplicate`, `unique`, `added`, `removed`, …) — the
 * owner decides what each key means and which colour it carries, and the board
 * never derives a hue of its own. The same key painted on any screen is the same
 * colour, because every screen receives the same theme.
 */

/** One semantic colour: the standing wash and the focused (hot) wash of a key. */
export interface SemanticColor {
	/** The standing fill: row wash AND ribbon, one continuous band. */
	readonly fill: string;
	/**
	 * The fill of the ONE chain under the pointer. The whole chain — every band,
	 * connector, caption and word — is painted in THIS one shade, uniformly.
	 * Absent = `fill` (the chain lights by its marks alone).
	 */
	readonly hot?: string;
	/** The ink of an explanation / caption written in this key. Absent = theme.dim. */
	readonly text?: string;
	/** The wash behind a standing text mark of this key. Absent = theme.paint. */
	readonly paint?: string;
}

/** The surface palette: paper, panels, edges, ink, font. */
export interface SurfaceTheme {
	readonly paper: string;
	readonly panel: string;
	readonly edge: string;
	readonly text: string;
	readonly dim: string;
	readonly faint: string;
	readonly mono: string;
	/** Default wash behind a painted text range when a key has no `paint`. */
	readonly paint?: string;
	/** Fallback ribbon colour when a key is unknown. */
	readonly ribbon?: string;
	/** Text-shadow underlay so glyphs read on a wash. */
	readonly shadow?: string;
}

/**
 * The complete theme. `colors` holds the semantic keys; the surface fields are
 * the chrome. Both arrive from props — the package ships a default preset only.
 */
export interface Theme extends SurfaceTheme {
	/** Semantic colour keys: duplicate / unique / added / removed / changed / … */
	readonly colors?: Readonly<Record<string, SemanticColor>>;
}

/** Resolve one semantic key to its colour, falling back to the surface ribbon. */
export const colorOf = (theme: Theme, key: string | undefined): SemanticColor =>
	(key !== undefined ? theme.colors?.[key] : undefined) ?? { fill: theme.ribbon ?? "transparent" };
