import { useMemo } from "react";
import type { BoardAction, ActionEntity, ActionPlacement, ActionParams } from "../actions-types.js";
import type { Emitter } from "../../board/events.js";

/**
 * Resolves the owner's single actions array for one entity + placement, and
 * wires each action's predicates and handler. The same logic serves Row, Column
 * and RibbonConnector — one implementation, three places (like a tooltip).
 */
export interface ActionsApi {
	readonly visible: readonly BoardAction[];
	readonly run: (action: BoardAction) => void;
	readonly isDisabled: (action: BoardAction) => boolean;
}

export const useActions = (
	actions: readonly BoardAction[],
	entity: ActionEntity,
	placement: ActionPlacement | readonly ActionPlacement[],
	params: Omit<ActionParams, "entity">,
	emit: Emitter["emit"],
): ActionsApi => {
	const placements = Array.isArray(placement) ? placement : [placement];
	const full = useMemo<ActionParams>(() => ({ entity, ...params }), [entity, params]);
	const visible = useMemo(
		() => actions.filter((a) => a.entity === entity && placements.includes(a.placement) && a.hidden?.(full) !== true),
		[actions, entity, placements, full],
	);
	return {
		visible,
		isDisabled: (action) => action.disabled?.(full) === true,
		run: (action) => {
			if (action.disabled?.(full) === true) return;
			action.onClick?.(full);
			emit(`${entity}:action` as "row:action", { ...full, actionId: action.id } as never);
		},
	};
};
