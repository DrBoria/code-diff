import type { BoardAction, ActionEntity, ActionPlacement, ActionParams } from "./actions-types.js";
import type { Emitter } from "../board/events.js";

/**
 * The pure resolution of the owner's single actions array for one entity +
 * placement: which actions are visible, which are disabled, and what running
 * one does (its handler + the entity's action event). No React — the hook only
 * memoizes this.
 */
export interface ActionsArgs {
	readonly actions: readonly BoardAction[];
	readonly entity: ActionEntity;
	readonly placement: ActionPlacement | readonly ActionPlacement[];
	readonly params: Omit<ActionParams, "entity">;
	readonly emit: Emitter["emit"];
}

export interface ActionsApi {
	readonly visible: readonly BoardAction[];
	readonly run: (action: BoardAction) => void;
	readonly isDisabled: (action: BoardAction) => boolean;
}

/** Run one action: its handler, then the entity's action event. */
const runAction = (action: BoardAction, full: ActionParams, entity: ActionEntity, emit: Emitter["emit"]): void => {
	if (action.disabled?.(full) === true) return;
	action.onClick?.(full);
	const payload = { ...full, actionId: action.id };
	if (entity === "row") emit("row:action", payload);
	else if (entity === "column") emit("column:action", payload);
	else emit("ribbon:action", payload);
};

export const resolveActions = ({ actions, entity, placement, params, emit }: ActionsArgs): ActionsApi => {
	const placements = Array.isArray(placement) ? placement : [placement];
	const full: ActionParams = { entity, ...params };
	return {
		visible: actions.filter((a) => a.entity === entity && placements.includes(a.placement) && a.hidden?.(full) !== true),
		isDisabled: (action) => action.disabled?.(full) === true,
		run: (action) => runAction(action, full, entity, emit),
	};
};
