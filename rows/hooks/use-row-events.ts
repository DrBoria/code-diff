import { useCallback } from "react";
import type { RowRef } from "../row-types.js";
import type { Emitter } from "../../board/events.js";

/**
 * Row interaction: click / double-click / hover / context-menu are reported as
 * events. The built-in click-to-focus is suppressible via event.preventDefault().
 */
export interface RowEventsApi {
	readonly click: (ref: RowRef) => boolean;
	readonly doubleClick: (ref: RowRef) => void;
	readonly enter: (ref: RowRef) => void;
	readonly leave: (ref: RowRef | null) => void;
	readonly contextMenu: (ref: RowRef) => void;
}

export const useRowEvents = (emit: Emitter["emit"]): RowEventsApi => ({
	click: useCallback((ref) => !emit("row:click", { row: ref }).defaultPrevented, [emit]),
	doubleClick: useCallback((ref) => void emit("row:doubleClick", { row: ref }), [emit]),
	enter: useCallback((ref) => void emit("row:mouseEnter", { row: ref }), [emit]),
	leave: useCallback((ref) => void emit("row:mouseLeave", { row: ref }), [emit]),
	contextMenu: useCallback((ref) => void emit("row:contextMenu", { row: ref }), [emit]),
});
