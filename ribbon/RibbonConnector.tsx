import { type ReactElement, type ReactNode } from "react";
import styled from "styled-components";
import type { RibbonConnector as Connector } from "./ribbon-types.js";

/**
 * The connector piece between two columns, positioned in the corridor. It hosts
 * the shared `Actions` component in WebStorm style: merge icons (apply left /
 * right / both, stage) sit INSIDE the connector, revealed on hover.
 */
const Holder = styled.div<{ $x: number; $y: number }>`
	position: absolute;
	left: ${(p) => p.$x}px;
	top: ${(p) => p.$y}px;
	transform: translate(-50%, -50%);
	z-index: 3;
	display: inline-flex;
	align-items: center;
	gap: 2px;
	pointer-events: auto;
`;

export interface RibbonConnectorProps {
	readonly connector: Connector;
	/** Left edge of the corridor cell, so root-absolute cx becomes cell-relative. */
	readonly originX?: number;
	readonly children?: ReactNode;
}

export const RibbonConnector = ({ connector, originX = 0, children }: RibbonConnectorProps): ReactElement => (
	<Holder $x={connector.cx - originX} $y={connector.cy} data-connector-actions={`${connector.from}->${connector.to}`}>
		{children}
	</Holder>
);
