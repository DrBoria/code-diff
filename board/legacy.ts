/**
 * ── LEGACY INPUT ADAPTER ───────────────────────────────────────────────────
 *
 * The uniqueness domains still produce the historical shape (columns of `items`,
 * `connections` with `ends.items` + `marks`, `blocks`, `tones`). This pure helper
 * translates that into the current contract (rows / ribbons / theme.colors) so a
 * consumer migrates by calling ONE function, not by rewriting its whole domain.
 * It is a bridge, not a second source of truth: the board only ever sees the new
 * shape.
 */
import type { Column } from "../columns/column-types.js";
import type { Row, RowId } from "../rows/row-types.js";
import type { Ribbon, RibbonEnd, RibbonTextAnchor } from "../ribbon/ribbon-types.js";
import type { Theme, SemanticColor } from "../styles/theme-types.js";

export interface LegacyItem {
	readonly id: RowId;
	readonly plate?: string;
	readonly text?: string;
	readonly tone?: string;
	readonly indent?: number;
	readonly block?: string;
	readonly blockParent?: boolean;
	readonly marks?: readonly { from: number; to: number; ink?: string }[];
	readonly notes?: readonly { from: number; text: string; title?: string }[];
	readonly segments?: readonly { text: string; paint?: boolean; ink?: string }[];
	readonly line?: string;
}
/** A legacy column is a Column whose rows are still called `items`. */
export interface LegacyColumn extends Omit<Column, "rows"> {
	readonly items?: readonly LegacyItem[];
}
/** Legacy ends carry `items`; new-shape ends (from resolveLanes) carry `rows`. */
export interface LegacyEnd extends Partial<RibbonEnd> {
	readonly column: string;
	readonly items?: readonly RowId[];
}
/** A legacy connection is a Ribbon whose ends/marks may use the old spelling. */
export interface LegacyConnection extends Omit<Ribbon, "ends" | "anchors"> {
	readonly ends: readonly LegacyEnd[];
	/** Legacy `marks` (with `twin`) or new-shape `anchors` (with `duplicate`). */
	readonly marks?: readonly (RibbonTextAnchor & { twin?: { column: string; line: string; from: number; to: number } })[];
	readonly anchors?: readonly RibbonTextAnchor[];
}
export interface LegacyBlock {
	readonly id: string;
	readonly tone?: string;
	readonly parent: readonly { column: string; items: readonly RowId[] }[];
	readonly members?: readonly { column: string; items: readonly RowId[] }[];
}
/** A legacy tone is a SemanticColor whose text ink was called `line`. */
export interface LegacyTone extends Omit<SemanticColor, "text"> {
	readonly line?: string;
}

export interface LegacyBoard {
	readonly columns: readonly LegacyColumn[];
	readonly connections?: readonly LegacyConnection[];
	readonly blocks?: readonly LegacyBlock[];
}

export interface AdaptedBoard {
	readonly columns: Column[];
	readonly ribbons: Ribbon[];
}

/** Translate legacy columns/connections/blocks into rows/ribbons. */
export const adaptLegacyBoard = (board: LegacyBoard): AdaptedBoard => {
	// A block assigns a group key + header flag to its rows, so the column lights
	// the whole group on hover (the new Row.group behaviour).
	const groupOf = new Map<string, { group: string; header: boolean }>();
	for (const block of board.blocks ?? []) {
		for (const end of block.parent) for (const id of end.items) groupOf.set(`${end.column}::${String(id)}`, { group: block.id, header: true });
		for (const end of block.members ?? []) for (const id of end.items) groupOf.set(`${end.column}::${String(id)}`, { group: block.id, header: false });
	}

	const columns: Column[] = board.columns.map((column) => ({
		id: column.id,
		...(column.title === undefined ? {} : { title: column.title }),
		...(column.mirrored === undefined ? {} : { mirrored: column.mirrored }),
		...(column.ratio === undefined ? {} : { ratio: column.ratio }),
		...(column.width === undefined ? {} : { width: column.width }),
		...(column.cap === undefined ? {} : { cap: column.cap }),
		...(column.fit === undefined ? {} : { fit: column.fit }),
		...(column.fold === undefined ? {} : { fold: column.fold }),
		...(column.path === undefined ? {} : { path: column.path }),
		rows: (column.items ?? []).map((item): Row => {
			const g = groupOf.get(`${column.id}::${String(item.id)}`);
			return {
				id: item.id,
				...(item.plate === undefined ? {} : { plate: item.plate }),
				...(item.text === undefined ? {} : { text: item.text }),
				...(item.tone === undefined ? {} : { tone: item.tone }),
				...(item.indent === undefined ? {} : { indent: item.indent }),
				...(item.marks === undefined ? {} : { marks: item.marks }),
				...(item.notes === undefined ? {} : { counters: item.notes }),
				...(item.segments === undefined ? {} : { spans: item.segments }),
				...(g === undefined ? {} : { group: g.group, groupHeader: g.header }),
			};
		}),
	}));

	const ribbons: Ribbon[] = (board.connections ?? []).map((connection) => {
		// Accept BOTH shapes: legacy `ends.items` and new `ends.rows` (resolveLanes
		// already emits the new shape, so a domain that uses it passes through intact).
		const ends: RibbonEnd[] = (connection.ends ?? []).map((end) => ({ column: end.column, rows: end.rows ?? end.items ?? [], ...(end.gap === undefined ? {} : { gap: end.gap }) }));
		const source: readonly (RibbonTextAnchor & { twin?: { column: string; line: string; from: number; to: number } })[] = connection.anchors ?? connection.marks ?? [];
		const anchors: RibbonTextAnchor[] = source.map((mark) => {
			const dup = mark.duplicate ?? mark.twin;
			return { column: mark.column, line: mark.line, from: mark.from, to: mark.to, ...(mark.ink === undefined ? {} : { ink: mark.ink }), ...(dup === undefined ? {} : { duplicate: dup }) };
		});
		return { id: connection.id, ...(connection.tone === undefined ? {} : { tone: connection.tone }), ...(connection.label === undefined ? {} : { label: connection.label }), ends, ...(anchors.length === 0 ? {} : { anchors }) };
	});

	return { columns, ribbons };
};

/** Translate a legacy tones map into the theme's semantic colours. */
export const adaptLegacyTones = (tones: Readonly<Record<string, LegacyTone>>): Record<string, SemanticColor> => {
	const colors: Record<string, SemanticColor> = {};
	for (const [key, tone] of Object.entries(tones)) {
		colors[key] = { fill: tone.fill, ...(tone.hot === undefined ? {} : { hot: tone.hot }), ...(tone.line === undefined ? {} : { text: tone.line }), ...(tone.paint === undefined ? {} : { paint: tone.paint }) };
	}
	return colors;
};

/** Build a theme from a legacy surface theme + tones map. */
export const adaptLegacyTheme = (theme: Omit<Theme, "colors">, tones: Readonly<Record<string, LegacyTone>>): Theme => ({ ...theme, colors: adaptLegacyTones(tones) });
