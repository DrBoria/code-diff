import { type ReactElement } from "react";
import styled from "styled-components";
import type { BoardAction, ActionEntity, ActionPlacement, ActionParams } from "./actions-types.js";
import { useActions } from "./hooks/use-actions.js";
import type { Emitter } from "../board/events.js";

/**
 * ONE action renderer for every entity. Two variants:
 *   • text  — a hidden label ABOVE the element, revealed on hover (VSCode lens)
 *   • icon  — a glyph INSIDE the element (WebStorm merge gutter / connector)
 * Applied identically to Row, Column and RibbonConnector.
 */

const IconButton = styled.button`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 18px;
	height: 16px;
	padding: 0 3px;
	border: 1px solid ${(p) => p.theme.edge};
	border-radius: 3px;
	background: ${(p) => p.theme.panel};
	color: ${(p) => p.theme.text};
	font: 10px/1 ${(p) => p.theme.mono};
	cursor: pointer;
	&:hover { background: ${(p) => p.theme.edge}; }
	&:disabled { opacity: 0.4; cursor: default; }
`;

const TextButton = styled.button<{ $hover: boolean }>`
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 0 4px;
	border: 0;
	background: transparent;
	color: ${(p) => p.theme.dim};
	font: 10px/14px ${(p) => p.theme.mono};
	cursor: pointer;
	opacity: ${(p) => (p.$hover ? 0 : 1)};
	transition: opacity 90ms ease;
	&:hover { color: ${(p) => p.theme.text}; }
	[data-actions-host]:hover & { opacity: 1; }
	&:disabled { opacity: 0.3; cursor: default; }
`;

export interface ActionsProps {
	readonly actions: readonly BoardAction[];
	readonly entity: ActionEntity;
	readonly placement: ActionPlacement | readonly ActionPlacement[];
	readonly params: Omit<ActionParams, "entity">;
	readonly emit: Emitter["emit"];
}

export const Actions = ({ actions, entity, placement, params, emit }: ActionsProps): ReactElement | null => {
	const { visible, run, isDisabled } = useActions(actions, entity, placement, params, emit);
	if (visible.length === 0) return null;
	return (
		<>
			{visible.map((action) => {
				const disabled = isDisabled(action);
				const hover = action.hover ?? action.placement === "above";
				if ((action.variant ?? (action.placement === "above" ? "text" : "icon")) === "text") {
					return (
						<TextButton key={action.id} type="button" $hover={hover} data-action={action.id} title={action.label} disabled={disabled} onClick={(e) => { e.stopPropagation(); run(action); }}>
							{action.icon}
							<span>{action.label}</span>
						</TextButton>
					);
				}
				return (
					<IconButton key={action.id} type="button" data-action={action.id} title={action.label} disabled={disabled} onClick={(e) => { e.stopPropagation(); run(action); }}>
						{action.icon ?? action.label.slice(0, 1)}
					</IconButton>
				);
			})}
		</>
	);
};
