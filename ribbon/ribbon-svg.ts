import type { Ribbon, MeasuredRibbon } from "./ribbon-types.js";
import { bandRect, type RibbonColumnBox } from "./ribbon-measure.js";
import type { ToneApi } from "./hooks/use-ribbon-tone.js";
import type { Theme } from "../styles/theme-types.js";
import type { RibbonContext } from "./ribbon-context.js";
import type { Scene } from "./ribbon-scene.js";

/**
 * The SVG writers of the backdrop: one path per row wash, one group per ribbon
 * (connectors + caption). Pure DOM writes — no measuring, no state. A focused
 * chain is painted in ONE uniform hot shade everywhere, never stacked.
 */

const NS = "http://www.w3.org/2000/svg";

const pathOf = (d: string, fill: string): SVGPathElement => {
	const path = document.createElementNS(NS, "path");
	path.setAttribute("d", d);
	path.setAttribute("fill", fill);
	path.setAttribute("stroke", "none");
	return path;
};

/** The row washes of every measured ribbon, in its chain's shade. */
export const bandPaths = (measured: readonly { ribbon: Ribbon; shape: MeasuredRibbon }[], columnBoxes: readonly RibbonColumnBox[], tone: ToneApi, hotRibbon: string | null): SVGElement[] => {
	const out: SVGElement[] = [];
	for (const { ribbon, shape } of measured) {
		const fill = hotRibbon === ribbon.id ? tone.hotOf(ribbon) : tone.fillOf(ribbon);
		for (const band of shape.bands) {
			const colBox = columnBoxes.find((c) => c.id === band.column)?.box;
			if (colBox == null) continue;
			out.push(pathOf(bandRect(band.top, band.bottom, colBox.left, colBox.right), fill));
		}
	}
	return out;
};

/** One group-hint wash: a hovered group HEADER lights its members, weaker. */
export const groupHintPath = (ctx: RibbonContext, key: string): SVGElement | null => {
	const [column, id] = key.split("::");
	if (column === undefined || id === undefined) return null;
	const box = ctx.lookup(column, id);
	const colBox = ctx.columnBoxes.find((c) => c.id === column)?.box;
	if (box === null || colBox == null) return null;
	const row = ctx.columns.find((c) => c.id === column)?.rows?.find((r) => String(r.id) === id);
	const color = ctx.tone.colorOfKey(row?.tone ?? "duplicate");
	const path = pathOf(bandRect(box.top, box.bottom, colBox.left, colBox.right), color.fill);
	path.setAttribute("data-group-hint", key);
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
