import { useCallback } from "react";
import type { Ribbon } from "../ribbon-types.js";
import type { Emitter } from "../../board/events.js";

/**
 * Ribbon interaction: hover focuses the whole chain, click reports the ribbon
 * (and focuses it unless the owner prevents the default). The board never
 * decides what a ribbon click means — it emits and the owner acts.
 */
export interface RibbonEventsApi {
	readonly hover: (ribbon: Ribbon | null) => void;
	readonly click: (ribbon: Ribbon) => void;
}

export const useRibbonEvents = (emit: Emitter["emit"], setFocused: (id: string | null) => void, focused: string | null): RibbonEventsApi => ({
	hover: useCallback(
		(ribbon) => {
			if (ribbon === null) emit("ribbon:mouseLeave", { ribbon: null });
			else emit("ribbon:mouseEnter", { ribbon });
		},
		[emit],
	),
	click: useCallback(
		(ribbon) => {
			const event = emit("ribbon:click", { ribbon });
			if (event.defaultPrevented) return;
			setFocused(focused === ribbon.id ? null : ribbon.id);
			emit("ribbon:focus", { ribbon: focused === ribbon.id ? null : ribbon });
		},
		[emit, setFocused, focused],
	),
});
