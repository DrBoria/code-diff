import { useMemo, useState } from "react";
import type { Column, ConnectedMap } from "../../columns/column-types.js";
import type { Ribbon } from "../../ribbon/ribbon-types.js";
import type { Chain, ChainApi } from "../../ribbon/hooks/use-ribbon-chain.js";
import type { RowRef, TextRangeHighlight } from "../../rows/row-types.js";
import type { RowGroups } from "../../rows/hooks/use-row-groups.js";
import { connectedMapOf } from "../../rows/hooks/use-row-fold.js";

/**
 * The board's focus state: which chain is hot under the pointer, which chain a
 * click picked, which rows a group header lights, and the text highlights of
 * the active chain. Hover NEVER narrows the fold — only a pick does.
 */
export interface BoardFocus {
	readonly hoverRibbon: string | null;
	readonly setHoverRibbon: (id: string | null) => void;
	readonly hoverRow: RowRef | null;
	readonly setHoverRow: (ref: RowRef | null) => void;
	readonly setHoverChar: (char: number | undefined) => void;
	readonly hotRibbon: string | null;
	readonly hotRows: ReadonlySet<string>;
	readonly connected: ConnectedMap;
	readonly highlights: ReadonlyMap<string, ReadonlyMap<string, readonly TextRangeHighlight[]>>;
}

/** The chain a hovered row/word names: the marking lane wins over the joining lane. */
const rowChainOf = (chain: ChainApi, hoverRow: RowRef | null, hoverChar: number | undefined): Chain | null => {
	if (hoverRow === null) return null;
	if (hoverChar !== undefined) {
		const word = chain.chainOfWord(hoverRow, hoverChar);
		if (word !== null) return word;
	}
	return chain.chainOfRow(hoverRow);
};

/** A group HEADER lights its members; a member lights only its own chain. */
const groupRowsOf = (hoverRow: RowRef | null, groups: RowGroups, columns: readonly Column[]): ReadonlySet<string> => {
	if (hoverRow === null) return new Set<string>();
	const group = groups.groupOf.get(`${hoverRow.column}::${String(hoverRow.row)}`);
	if (group === undefined) return new Set<string>();
	const row = columns.find((c) => c.id === hoverRow.column)?.rows?.find((r) => String(r.id) === String(hoverRow.row));
	if (row?.groupHeader !== true) return new Set<string>();
	return new Set(groups.byGroup.get(group) ?? []);
};

/** The text ranges of the active chain, per column and row. */
const highlightsOf = (active: Chain | null): ReadonlyMap<string, ReadonlyMap<string, readonly TextRangeHighlight[]>> => {
	const map = new Map<string, Map<string, TextRangeHighlight[]>>();
	if (active === null) return map;
	for (const anchor of active.anchors) {
		const rows = map.get(anchor.column) ?? new Map<string, TextRangeHighlight[]>();
		const list = rows.get(anchor.line) ?? [];
		list.push({ from: anchor.from, to: anchor.to, strong: true, ...(anchor.ink === undefined ? {} : { ink: anchor.ink }) });
		rows.set(anchor.line, list);
		map.set(anchor.column, rows);
	}
	return map;
};

export interface BoardFocusArgs {
	readonly ribbons: readonly Ribbon[];
	readonly columns: readonly Column[];
	readonly chain: ChainApi;
	readonly groups: RowGroups;
	readonly pickedRibbon: string | null;
}

export const useBoardFocus = ({ ribbons, columns, chain, groups, pickedRibbon }: BoardFocusArgs): BoardFocus => {
	const [hoverRibbon, setHoverRibbon] = useState<string | null>(null);
	const [hoverRow, setHoverRow] = useState<RowRef | null>(null);
	const [hoverChar, setHoverChar] = useState<number | undefined>(undefined);

	const focusedChain = pickedRibbon === null ? null : chain.chainOfRibbon(pickedRibbon);
	const rowChain = rowChainOf(chain, hoverRow, hoverChar);
	// Hover wins while it lasts; when the pointer leaves, the PICKED chain stays
	// lit (click-to-focus keeps its chain glowing until another pick or unpick).
	const hotRibbon = hoverRibbon ?? (rowChain?.ribbon.id ?? null) ?? pickedRibbon;
	const hotRows = useMemo(() => groupRowsOf(hoverRow, groups, columns), [hoverRow, groups, columns]);
	const connected = useMemo(() => {
		const ends = focusedChain === null ? ribbons.flatMap((r) => r.ends) : focusedChain.ribbon.ends;
		return connectedMapOf(columns, ends);
	}, [columns, ribbons, focusedChain]);
	const highlights = useMemo(() => highlightsOf(rowChain ?? focusedChain), [rowChain, focusedChain]);

	return { hoverRibbon, setHoverRibbon, hoverRow, setHoverRow, setHoverChar, hotRibbon, hotRows, connected, highlights };
};
