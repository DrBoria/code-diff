import type { PointerEvent as ReactPointerEvent } from "react";
import type { Ribbon } from "../../ribbon/ribbon-types.js";
import type { RowRef } from "../../rows/row-types.js";
import type { ChainApi } from "../../ribbon/hooks/use-ribbon-chain.js";
import type { Emitter } from "../events.js";
import { charAt } from "../../rows/row-caret.js";
import { htmlOf } from "../../surface/dom.js";

/**
 * The board's pointer handlers: hovering a row/word names its chain, clicking a
 * row picks (filters) its chain, and both are reported as events first — a
 * listener may preventDefault to replace the built-in behaviour.
 */
export interface PointerHandlers {
	readonly onPointerOver: (event: ReactPointerEvent<HTMLDivElement>) => void;
	readonly onClick: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export interface PointerArgs {
	readonly emit: Emitter["emit"];
	readonly chain: ChainApi;
	readonly focusedRibbon: string | null;
	readonly setFocused: (id: string | null) => void;
	readonly setHoverRow: (ref: RowRef | null) => void;
	readonly setHoverRibbon: (id: string | null) => void;
	readonly setHoverChar: (char: number | undefined) => void;
}

/** The row a pointer event is over, or null. */
const rowAt = (target: HTMLElement): RowRef | null => {
	const cell = target.closest("[data-column]");
	const row = target.closest("[data-item]");
	if (!(cell instanceof HTMLElement) || !(row instanceof HTMLElement) || row.dataset.item === undefined) return null;
	return { column: cell.dataset.column ?? "", row: row.dataset.item };
};

export const useBoardPointer = ({ emit, chain, focusedRibbon, setFocused, setHoverRow, setHoverRibbon, setHoverChar }: PointerArgs): PointerHandlers => ({
	onPointerOver: (event) => {
		const target = htmlOf(event.target);
		if (target === null || target.closest("svg") !== null) return;
		const ref = rowAt(target);
		if (ref === null) {
			setHoverRow(null);
			setHoverChar(undefined);
			return;
		}
		const anchor = target.closest("[data-anchor]");
		setHoverChar(charAt(anchor instanceof HTMLElement ? anchor : target, event.clientX, event.clientY));
		setHoverRow(ref);
		setHoverRibbon(null);
	},
	onClick: (event) => {
		const target = htmlOf(event.target);
		if (target === null) return;
		if (target.closest("[data-action]") !== null || target.closest("[data-fold]") !== null) return;
		const ref = rowAt(target);
		if (ref === null) return;
		if (emit("row:click", { row: ref }).defaultPrevented) return;
		const c = chain.chainOfRow(ref);
		if (c !== null) setFocused(focusedRibbon === c.ribbon.id ? null : c.ribbon.id);
	},
});

/** The ribbon a pointer event is over (its SVG group carries data-ribbon). */
export const ribbonAt = (target: Element, ribbons: readonly Ribbon[]): Ribbon | null => {
	const id = target.closest("[data-ribbon]")?.getAttribute("data-ribbon");
	return id == null ? null : (ribbons.find((r) => r.id === id) ?? null);
};
