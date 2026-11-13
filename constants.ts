// ── THE VIEW'S OWN VOCABULARY ──────────────────────────────────────────────
//
// Only the words the diff engine needs to align two texts. No colours, no
// domain: a row type and the token splitter are display facts, the same for any
// model that hands the view two spans.

/** The kinds of row a line diff produces. */
export const ROW = {
	Equal: "equal",
	Change: "change",
	Add: "add",
	Remove: "remove",
	Fold: "fold",
} as const;

export type RowType = (typeof ROW)[keyof typeof ROW];

/** Diff limits: how much context stays visible, and when a line is too big to word-diff. */
export const DIFF = {
	Context: 3,
	MaxWordTokens: 400,
} as const;

// How a line is cut into comparable words: identifiers, runs of space, and single
// punctuation marks. NOT frozen — a global regex carries `lastIndex`.
export const WORD_TOKEN_RE = /[\w$]+|\s+|[^\w$\s]/g;