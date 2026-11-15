import type { ReactNode } from "react";
import type { Column, Fit, SyncGroup } from "../columns/column-types.js";
import type { Row, RowId, RowRef, Token } from "../rows/row-types.js";
import type { Ribbon } from "../ribbon/ribbon-types.js";
import type { Theme } from "../styles/theme-types.js";
import type { BoardAction } from "../components/actions-types.js";
import type { Events } from "./events.js";

/**
 * ── BOARD ──────────────────────────────────────────────────────────────────
 *
 * The composition root's contract. Props stay thin: data (columns / ribbons),
 * one actions array, one events map, one controlled state, one theme, one config.
 */

/** The board's interaction state, controlled or internal. */
export interface BoardState {
	/** true = every row shown; false = folded to connected rows. */
	readonly revealed: boolean;
	/** The focused ribbon id (click-to-filter), or null. */
	readonly focusedRibbon: string | null;
	/** Selected rows (staged), independent of focus. */
	readonly selected: readonly RowRef[];
	/** Per-column sort direction. */
	readonly sort: Readonly<Record<string, "asc" | "desc" | null>>;
	/** Per-column filter text. */
	readonly filter: Readonly<Record<string, string>>;
}

export const initialState: BoardState = { revealed: false, focusedRibbon: null, selected: [], sort: {}, filter: {} };

/** Display knobs; every field has a default in config.ts. */
export interface BoardConfig {
	readonly rowHeight?: number;
	readonly bandGap?: number;
	readonly diffContext?: number;
	readonly maxWordTokens?: number;
	readonly fullMount?: number;
	readonly overscan?: number;
	readonly maxHeight?: string;
	readonly boardHeight?: string;
	readonly foldUnconnected?: boolean;
	readonly foldLabel?: (count: number) => string;
	readonly ribbonHeight?: number;
}

/** A custom row renderer plugin. */
export type RowRender = (args: { row: Row; column: Column; index: number; mirrored: boolean }) => ReactNode;

/** A custom column renderer plugin (a new column kind). */
export type ColumnRender = (props: { column: Column }) => ReactNode;

export interface BoardProps {
	readonly columns: readonly Column[];
	readonly ribbons?: readonly Ribbon[];
	readonly corridors?: readonly (number | undefined)[];
	readonly sync?: readonly SyncGroup[];
	readonly fit?: Fit;
	readonly theme?: Partial<Theme>;
	readonly config?: BoardConfig;
	readonly actions?: readonly BoardAction[];
	readonly events?: Events;
	/** Controlled state; omit to let the board own it internally. */
	readonly state?: Partial<BoardState>;
	/** Initial reveal when uncontrolled. */
	readonly reveal?: boolean;
	readonly tokenize?: (text: string, column: string) => readonly Token[];
	readonly renderRow?: RowRender;
	readonly renderers?: Readonly<Record<string, ColumnRender>>;
}

/** Resolved config (defaults filled). */
export interface ResolvedConfig extends Required<Omit<BoardConfig, "boardHeight" | "foldLabel">> {
	readonly boardHeight?: string;
	readonly foldLabel: (count: number) => string;
}

export type { RowId };
