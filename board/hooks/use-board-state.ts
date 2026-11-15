import { useCallback, useMemo, useState } from "react";
import { initialState, type BoardState } from "../board-types.js";
import type { RowRef } from "../../rows/row-types.js";
import type { Emitter } from "../events.js";

/**
 * The board's interaction state, controlled or internal. When the owner passes
 * `state`, the board shows exactly it and reports every change through
 * `board:stateChange`; otherwise it owns the state and still reports changes.
 */
export interface BoardStateApi {
	readonly state: BoardState;
	readonly setRevealed: (revealed: boolean) => void;
	readonly setFocused: (id: string | null) => void;
	readonly toggleSelect: (ref: RowRef) => void;
	readonly setSelected: (selected: readonly RowRef[]) => void;
	readonly setSort: (column: string, direction: "asc" | "desc" | null) => void;
	readonly setFilter: (column: string, value: string) => void;
}

/** A stable key for a row reference (column + row id). */
export const rowKey = (ref: RowRef): string => `${ref.column}::${String(ref.row)}`;

export const useBoardState = (controlled: Partial<BoardState> | undefined, initialReveal: boolean, emit: Emitter["emit"]): BoardStateApi => {
	const [internal, setInternal] = useState<BoardState>({ ...initialState, revealed: initialReveal });
	const state = useMemo<BoardState>(() => ({ ...internal, ...(controlled ?? {}) }), [internal, controlled]);

	const commit = useCallback(
		(next: BoardState): void => {
			setInternal(next);
			emit("board:stateChange", { state: next });
		},
		[emit],
	);

	return {
		state,
		setRevealed: (revealed) => {
			commit({ ...state, revealed });
			emit("board:revealChange", { revealed });
		},
		setFocused: (focusedRibbon) => commit({ ...state, focusedRibbon }),
		setSelected: (selected) => {
			commit({ ...state, selected });
			emit("row:selectionChange", { selected });
		},
		toggleSelect: (ref) => {
			const key = rowKey(ref);
			const has = state.selected.some((entry) => rowKey(entry) === key);
			const selected = has ? state.selected.filter((entry) => rowKey(entry) !== key) : [...state.selected, ref];
			commit({ ...state, selected });
			emit("row:select", { row: ref, selected: !has });
			emit("row:selectionChange", { selected });
		},
		setSort: (column, direction) => {
			commit({ ...state, sort: { ...state.sort, [column]: direction } });
			emit("column:sort", { column, direction });
		},
		setFilter: (column, value) => {
			commit({ ...state, filter: { ...state.filter, [column]: value } });
			emit("column:filter", { column, value });
		},
	};
};
