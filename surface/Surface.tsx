import { forwardRef, type ReactElement, type ReactNode } from "react";
import styled from "styled-components";

/**
 * The backdrop layer: an absolutely-positioned SVG under the columns. Ribbons
 * paint into it imperatively; the Surface itself holds no logic. Columns sit
 * above it (z-index 2) so a band is a background, never a curtain over text.
 */
export const Layer = styled.svg`
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	overflow: hidden;
	pointer-events: none;
	& [data-ribbon] { cursor: pointer; }
	& [data-ribbon] path { pointer-events: auto; }
	& text { pointer-events: auto; cursor: default; }
`;

export const Surface = forwardRef<SVGSVGElement, { children?: ReactNode; onPointerOver?: (e: React.PointerEvent<SVGSVGElement>) => void; onPointerLeave?: () => void; onClick?: (e: React.PointerEvent<SVGSVGElement>) => void }>(
	({ children, ...handlers }, ref): ReactElement => (
		<Layer ref={ref} {...handlers}>
			{children}
		</Layer>
	),
);
Surface.displayName = "Surface";
