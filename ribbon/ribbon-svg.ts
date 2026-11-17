import type { Ribbon, MeasuredRibbon } from "./ribbon-types.js";
import type { Box } from "../rows/row-types.js";
import type { ToneApi } from "./hooks/use-ribbon-tone.js";
import type { Theme } from "../styles/theme-types.js";
import type { RibbonContext } from "./ribbon-context.js";
import type { Scene } from "./ribbon-scene.js";

/**
 * The SVG writers of the backdrop: one band per CHAIN row, one group per ribbon
 * (connectors + caption). Pure DOM writes — no measuring, no state. A focused
 * chain is painted in ONE uniform hot shade everywhere — bands AND road —
 * never stacked. Rows outside any chain are NEVER washed.
 */

const NS = "http://www.w3.org/2000/svg";

const pathOf = (d: string, fill: string): SVGPathElement => {
	const path = document.createElementNS(NS, "path");
	path.setAttribute("d", d);
	path.setAttribute("fill", fill);
	path.setAttribute("stroke", "none");
	return path;
};

/**
 * One group-hint RIBBON: a hovered group HEADER lights its members with
 * row-height lanes — the SAME strip shape as a ribbon, never a 2px wire and
 * never a wash over rows outside the group. Members on two columns are joined;
 * a one-column group gets a stub at the corridor edge.
 */
/** The corridor-side edges of a hint lane: from this column towards its
 *  nearest neighbour (a 14px stub when the group lives in one column). */
const hintEdges = (ctx: RibbonContext, column: string, colBox: Box): { x1: number; x2: number } => {
	const centre = (colBox.left + colBox.right) / 2;
	const others = ctx.columnBoxes.filter((c): c is { id: string; box: Box } => c.id !== column && c.box !== null);
	const edge = (c: { id: string; box: Box }): number => (c.box.left > colBox.right ? c.box.left : c.box.right);
	if (others.length === 0) {
		const x1 = colBox.left <= centre ? colBox.right : colBox.left;
		return { x1, x2: x1 + (x1 === colBox.right ? 14 : -14) };
	}
	const twin = others.reduce((best, c) => (Math.abs(edge(c) - centre) < Math.abs(edge(best) - centre) ? c : best));
	const toRight = twin.box.left > colBox.right;
	return { x1: toRight ? colBox.right : colBox.left, x2: edge(twin) };
};

export const groupHintPath = (ctx: RibbonContext, key: string): SVGElement | null => {
	const [column, id] = key.split("::");
	if (column === undefined || id === undefined) return null;
	const box = ctx.lookup(column, id);
	const colBox = ctx.columnBoxes.find((c) => c.id === column)?.box;
	if (box === null || colBox == null) return null;
	const row = ctx.columns.find((c) => c.id === column)?.rows?.find((r) => String(r.id) === id);
	const color = ctx.tone.colorOfKey(row?.tone ?? "duplicate");
	const { x1, x2 } = hintEdges(ctx, column, colBox);
	const mx = (x1 + x2) / 2;
	const { top, bottom } = box;
	const path = pathOf(`M ${x1} ${top} C ${mx} ${top}, ${mx} ${top}, ${x2} ${top} L ${x2} ${bottom} C ${mx} ${bottom}, ${mx} ${bottom}, ${x1} ${bottom} Z`, color.fill);
	path.setAttribute("data-group-hint", key);
	return path;
};

/** One CHAIN row's band: a full-height strip over the row, in the chain's one
 *  shade (hot when its chain is focused). Never painted for rows outside it. */
export const bandPath = (ctx: RibbonContext, band: { column: string; top: number; bottom: number }, fill: string, key: string): SVGElement | null => {
	const colBox = ctx.columnBoxes.find((c) => c.id === band.column)?.box;
	if (colBox == null) return null;
	const { left, right } = colBox;
	const path = pathOf(`M ${left} ${band.top} L ${right} ${band.top} L ${right} ${band.bottom} L ${left} ${band.bottom} Z`, fill);
	path.setAttribute("data-band", key);
	return path;
};

export interface RibbonGroupArgs {
	readonly ribbon: Ribbon;
	readonly shape: MeasuredRibbon;
	readonly tone: ToneApi;
	readonly theme: Theme;
	readonly hot: boolean;
}

/** One ribbon's group: its connectors and its caption, in one shade. */
export const ribbonGroup = ({ ribbon, shape, tone, theme, hot }: RibbonGroupArgs): SVGGElement => {
	const fill = hot ? tone.hotOf(ribbon) : tone.fillOf(ribbon);
	const group = document.createElementNS(NS, "g");
	group.setAttribute("data-ribbon", shape.id);
	group.setAttribute("data-hot", hot ? "true" : "false");
	for (const connector of shape.connectors) group.append(pathOf(connector.path, fill));
	if (shape.caption !== null && shape.label !== null) {
		const text = document.createElementNS(NS, "text");
		text.setAttribute("x", String(shape.caption.x));
		text.setAttribute("y", String(shape.caption.y));
		text.setAttribute("text-anchor", "middle");
		text.setAttribute("font-size", "10");
		text.setAttribute("font-family", theme.mono);
		text.setAttribute("fill", hot ? theme.text : theme.dim);
		text.setAttribute("data-caption", shape.id);
		text.textContent = shape.label;
		group.append(text);
	}
	return group;
};

/** Ensure a layer group exists inside the SVG, creating it once. */
export const layerGroup = (svg: SVGSVGElement, current: SVGGElement | null): SVGGElement => {
	if (current !== null) return current;
	const group = document.createElementNS(NS, "g");
	svg.append(group);
	return group;
};

export interface CommitArgs {
	readonly svg: SVGSVGElement;
	readonly layers: { bands: SVGGElement | null; ribbons: SVGGElement | null };
	readonly scene: Scene;
	readonly ctx: RibbonContext;
	readonly theme: Theme;
}

/** Commit a whole scene to the SVG: the wash layer, then the ribbon layer. */
export const commitScene = ({ svg, layers, scene, ctx, theme }: CommitArgs): { bands: SVGGElement; ribbons: SVGGElement } => {
	const bands = layerGroup(svg, layers.bands);
	bands.replaceChildren(...scene.bands);
	const ribbons = layerGroup(svg, layers.ribbons);
	ribbons.replaceChildren(...scene.measured.map(({ ribbon, shape }) => ribbonGroup({ ribbon, shape, tone: ctx.tone, theme, hot: ctx.hotRibbon === ribbon.id })));
	return { bands, ribbons };
};
