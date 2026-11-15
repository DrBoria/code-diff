import styled from "styled-components";
import type { BoardProps } from "./board-types.js";

/**
 * The board's grid chrome: the frame, a column cell, and a corridor. Pure layout
 * — no interaction logic. Extracted so the composition root stays a thin wiring
 * component.
 */

export const Frame = styled.div<{ $template: string; $height?: string | undefined }>`
	position: relative;
	display: grid;
	grid-template-columns: ${(p) => p.$template};
	grid-template-rows: ${(p) => (p.$height === undefined ? "auto" : "minmax(0, 1fr)")};
	align-items: ${(p) => (p.$height === undefined ? "start" : "stretch")};
	width: 100%;
	min-width: 0;
	${(p) => (p.$height === undefined ? "" : `height: ${p.$height};`)}
	overflow: hidden;
	font-family: ${(p) => p.theme.mono};
	font-size: 12px;
	background: ${(p) => p.theme.paper};
`;

export const Cell = styled.div<{ $cap: boolean; $bounded: boolean }>`
	position: relative;
	z-index: 2;
	min-width: 0;
	${(p) => (p.$bounded ? "height: 100%; min-height: 0; overflow: hidden;" : "")}
	${(p) => (p.$cap && !p.$bounded ? "height: 0; min-height: 100%;" : "")}
`;

export const Corridor = styled.div`
	min-width: 0;
	position: relative;
	/* The corridor must NOT block the ribbon beneath it: the SVG layer (z-index 1)
	   owns hover/click on the band. Only the action holders inside re-enable
	   pointer events, so the ribbon stays interactive everywhere else. */
	pointer-events: none;
`;

/** One column's grid width: a ratio, a fixed width, or an equal share. */
const widthOf = (column: BoardProps["columns"][number]): string => {
	if (column.ratio !== undefined) return `${column.ratio}fr`;
	if (column.width === undefined) return "minmax(0, 1fr)";
	return `${column.width}px`;
};

/** The grid template: a width per column plus a corridor after some of them. */
export const templateOf = (props: BoardProps): string =>
	props.columns
		.map((column, index) => {
			const width = widthOf(column);
			const corridor = props.corridors?.[index];
			if (corridor === undefined) return width;
			return props.fit === "rubber" ? `${width} minmax(0, ${corridor}px)` : `${width} ${corridor}px`;
		})
		.join(" ");
