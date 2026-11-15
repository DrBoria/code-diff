import type { ReactNode } from "react";
import type { RowRef } from "../rows/row-types.js";
import type { Ribbon } from "../ribbon/ribbon-types.js";

/**
 * ── ACTIONS ────────────────────────────────────────────────────────────────
 *
 * ONE array of action definitions, in the spirit of MUI DataGrid / AG Grid /
 * Syncfusion: each item carries its own handler and predicate params, and the
 * board renders it wherever its `placement` says. There is no per-event prop
 * clutter — the owner hands one `actions` array and one `events` map.
 *
 * The same `Actions` component renders for Row, Column and RibbonConnector:
 * either hidden text ABOVE the element (VSCode code-lens style) or icons INSIDE
 * the element (WebStorm merge style), chosen by `variant`.
 */

/** Which entity an action belongs to. */
export type ActionEntity = "row" | "column" | "ribbon";

/** Where the action is drawn. */
export type ActionPlacement =
	| "above" // hidden text above the element, revealed on hover (VSCode)
	| "inside-start" // icon at the start edge inside the element
	| "inside-end" // icon at the end edge inside the element
	| "connector" // icon inside a ribbon connector (WebStorm merge)
	| "header" // column header
	| "toolbar"; // board toolbar

/** How the action is drawn. */
export type ActionVariant = "text" | "icon";

/** Params handed to an action's predicates and handler (grid-style). */
export interface ActionParams {
	readonly entity: ActionEntity;
	/** The row, when entity is row. */
	readonly row?: RowRef;
	/** The column id, when entity is column. */
	readonly column?: string;
	/** The ribbon, when entity is ribbon. */
	readonly ribbon?: Ribbon;
	/** Currently selected rows. */
	readonly selected: readonly RowRef[];
}

/** One action definition. */
export interface BoardAction {
	readonly id: string;
	readonly label: string;
	readonly icon?: ReactNode;
	readonly entity: ActionEntity;
	readonly placement: ActionPlacement;
	/** text = hidden label above (VSCode); icon = glyph inside (WebStorm). */
	readonly variant?: ActionVariant;
	/** Reveal only while the element is hovered. Default true for `above`. */
	readonly hover?: boolean;
	readonly disabled?: (params: ActionParams) => boolean;
	readonly hidden?: (params: ActionParams) => boolean;
	/** The owner's handler. The board also emits `<entity>:action`. */
	readonly onClick?: (params: ActionParams) => void;
}
