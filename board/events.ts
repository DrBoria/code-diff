import type { RowRef } from "../rows/row-types.js";
import type { Ribbon } from "../ribbon/ribbon-types.js";
import type { ActionParams } from "../components/actions-types.js";
import type { BoardState } from "./board-types.js";

/**
 * ── EVENTS ─────────────────────────────────────────────────────────────────
 *
 * A flexible catalog in the spirit of MUI DataGrid / AG Grid / Syncfusion: the
 * owner subscribes with ONE `events` map keyed by event name. Each entity emits
 * its own slice (row / column / ribbon / board). Handlers receive typed params
 * plus a cancellable `event` object — set `event.defaultPrevented = true` to
 * suppress the board's built-in behaviour and implement your own.
 */

/** A cancellable event envelope, like MUI's MuiEvent. */
export interface BoardEvent {
	defaultPrevented: boolean;
	preventDefault(): void;
}

export const makeEvent = (): BoardEvent => ({
	defaultPrevented: false,
	preventDefault() {
		this.defaultPrevented = true;
	},
});

/** Row events. */
export interface RowEventMap {
	"row:click": { row: RowRef };
	"row:doubleClick": { row: RowRef };
	"row:mouseEnter": { row: RowRef };
	"row:mouseLeave": { row: RowRef | null };
	"row:contextMenu": { row: RowRef };
	"row:select": { row: RowRef; selected: boolean };
	"row:selectionChange": { selected: readonly RowRef[] };
	"row:hide": { rows: readonly RowRef[] };
	"row:show": { rows: readonly RowRef[] };
	"row:expand": { row: RowRef };
	"row:collapse": { row: RowRef };
	"row:reorder": { row: RowRef; toIndex: number };
	"row:action": ActionParams & { actionId: string };
}

/** Column events. */
export interface ColumnEventMap {
	"column:click": { column: string };
	"column:mouseEnter": { column: string };
	"column:mouseLeave": { column: string | null };
	"column:headerClick": { column: string };
	"column:sort": { column: string; direction: "asc" | "desc" | null };
	"column:filter": { column: string; value: string };
	"column:resize": { column: string; width: number };
	"column:scroll": { column: string; top: number; left: number };
	"column:visibilityChange": { column: string; visible: boolean };
	"column:reorder": { column: string; toIndex: number };
	"column:action": ActionParams & { actionId: string };
}

/** Ribbon events. */
export interface RibbonEventMap {
	"ribbon:click": { ribbon: Ribbon };
	"ribbon:mouseEnter": { ribbon: Ribbon };
	"ribbon:mouseLeave": { ribbon: Ribbon | null };
	"ribbon:focus": { ribbon: Ribbon | null };
	"ribbon:action": ActionParams & { actionId: string };
}

/** Board lifecycle / state events. */
export interface BoardEventMap {
	"board:ready": { columns: number; ribbons: number };
	"board:stateChange": { state: BoardState };
	"board:revealChange": { revealed: boolean };
	"board:resize": { width: number; height: number };
}

/** The full catalog. */
export interface EventMap extends RowEventMap, ColumnEventMap, RibbonEventMap, BoardEventMap {}

export type EventName = keyof EventMap;

/** One handler: typed params + cancellable envelope. */
export type EventHandler<K extends EventName> = (params: EventMap[K], event: BoardEvent) => void;

/** The owner's subscription map: one or many handlers per event. */
export type Events = { [K in EventName]?: EventHandler<K> | readonly EventHandler<K>[] };

/** A dispatcher that runs every handler for an event and reports cancellation. */
export interface Emitter {
	emit<K extends EventName>(name: K, params: EventMap[K]): BoardEvent;
}

export const makeEmitter = (events: Events | undefined): Emitter => ({
	emit<K extends EventName>(name: K, params: EventMap[K]): BoardEvent {
		const event = makeEvent();
		const entry = events?.[name] as EventHandler<K> | readonly EventHandler<K>[] | undefined;
		if (entry === undefined) return event;
		const handlers = Array.isArray(entry) ? entry : [entry];
		for (const handler of handlers) handler(params, event);
		return event;
	},
});
