import { useMemo } from "react";
import { resolveActions, type ActionsArgs, type ActionsApi } from "../actions-resolve.js";

/**
 * Resolves the owner's single actions array for one entity + placement. The
 * resolution itself is pure (actions-resolve); this hook only memoizes it, so
 * the same logic serves Row, Column and RibbonConnector — one implementation,
 * three places (like a tooltip).
 */
export type { ActionsArgs, ActionsApi };

export const useActions = (args: ActionsArgs): ActionsApi =>
	useMemo(() => resolveActions(args), [args.actions, args.entity, args.placement, args.params, args.emit]);
