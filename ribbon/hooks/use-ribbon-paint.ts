import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import type { Column } from "../../columns/column-types.js";
import type { Ribbon, MeasuredRibbon } from "../ribbon-types.js";
import { measureLayout, layoutLookup, readScrollTops, layoutColumn } from "../../surface/hooks/use-surface-measure.js";
import { measureRibbon, bandRect, type RibbonColumnBox } from "../ribbon-path.js";
import type { ToneApi } from "./use-ribbon-tone.js";
import type { Theme } from "../../styles/theme-types.js";

/**
 * Imperative paint of the backdrop: row washes (once per row) + ribbon connectors
 * + captions. A focused chain is painted in ONE uniform hot shade everywhere —
 * bands, connectors, captions — never stacked, never partial. Re-runs on layout,
 * scroll and hover; geometry is recomputed from real boxes so nothing drifts.
 */

const NS = "http://www.w3.org/2000/svg";

export interface RibbonPaintArgs {
	readonly root: RefObject<HTMLDivElement | null>;
	readonly layer: RefObject<SVGSVGElement | null>;
	readonly columns: readonly Column[];
	readonly ribbons: readonly Ribbon[];
	readonly tone: ToneApi;
	readonly theme: Theme;
	readonly rowHeight: number;
	readonly bandGap: number;
	/** The focused chain's ribbon id (hover or pick), or null. */
	readonly hotRibbon: string | null;
	/** Row keys lit by a hovered group (column::id). */
	readonly hotRows: ReadonlySet<string>;
	/** Bumped whenever the content/size changes, so paint re-runs after a reveal. */
	readonly revision: number;
}

export const useRibbonPaint = (args: RibbonPaintArgs): (() => void) => {
	const { root, layer, columns, ribbons, tone, theme, rowHeight, bandGap, hotRibbon, hotRows, revision } = args;
	const bandLayer = useRef<SVGGElement | null>(null);
	const ribbonLayer = useRef<SVGGElement | null>(null);

	const paint = useCallback((): void => {
		const svg = layer.current;
		const element = root.current;
		if (svg === null || element === null) return;
		// Measure the LIVE DOM every paint: a reveal/fold mounts new rows in a child
		// commit, and a cached layout snapshot can lag it. Reading the real boxes here
		// means a ribbon can never point at a stale (or empty) position.
		const layout = measureLayout(element, bandGap);
		const scrollTops = readScrollTops(element);
		const lookup = layoutLookup(layout, scrollTops);
		const columnBoxes: RibbonColumnBox[] = columns.map((c) => ({ id: c.id, box: layoutColumn(layout, c.id) }));

		if (bandLayer.current === null) {
			bandLayer.current = document.createElementNS(NS, "g");
			svg.append(bandLayer.current);
		}
		if (ribbonLayer.current === null) {
			ribbonLayer.current = document.createElementNS(NS, "g");
			svg.append(ribbonLayer.current);
		}

		// ── ROW WASH, ONCE PER ROW ──────────────────────────────────────────
		// Each row is painted exactly once. A row in the focused chain (or a lit
		// group) takes the chain's uniform hot shade; otherwise its own tone fill.
		const bandChildren: SVGElement[] = [];
		const painted = new Set<string>();
		const measured: { ribbon: Ribbon; shape: MeasuredRibbon }[] = [];
		for (const ribbon of ribbons) {
			const shape = measureRibbon(ribbon, columnBoxes, lookup, rowHeight);
			if (shape === null) continue;
			measured.push({ ribbon, shape });
		}
		const hotChain = hotRibbon === null ? null : (measured.find((m) => m.ribbon.id === hotRibbon) ?? null);
		const hotKeys = new Set<string>();
		if (hotChain !== null) for (const end of hotChain.ribbon.ends ?? []) for (const id of end.rows ?? []) hotKeys.add(`${end.column}::${String(id)}`);

		for (const { ribbon, shape } of measured) {
			const isHot = hotRibbon === ribbon.id;
			const fill = isHot ? tone.hotOf(ribbon) : tone.fillOf(ribbon);
			for (const band of shape.bands) {
				const colBox = columnBoxes.find((c) => c.id === band.column)?.box;
				if (colBox === null || colBox === undefined) continue;
				const path = document.createElementNS(NS, "path");
				path.setAttribute("d", bandRect(band.top, band.bottom, colBox.left, colBox.right));
				path.setAttribute("fill", fill);
				bandChildren.push(path);
			}
		}
		// Group-lit rows (no ribbon): paint their own tone hot, once.
		for (const key of hotRows) {
			if (hotKeys.has(key) || painted.has(key)) continue;
			const [column, id] = key.split("::");
			if (column === undefined || id === undefined) continue;
			const box = lookup(column, id);
			const colBox = columnBoxes.find((c) => c.id === column)?.box;
			if (box === null || colBox === null || colBox === undefined) continue;
			const row = columns.find((c) => c.id === column)?.rows?.find((r) => String(r.id) === id);
			const color = tone.colorOfKey(row?.tone ?? "duplicate");
			const path = document.createElementNS(NS, "path");
			path.setAttribute("d", bandRect(box.top, box.bottom, colBox.left, colBox.right));
			path.setAttribute("fill", color.hot ?? color.fill);
			bandChildren.push(path);
			painted.add(key);
		}
		bandLayer.current.replaceChildren(...bandChildren);

		// ── RIBBON CONNECTORS + CAPTIONS, ONE SHADE PER CHAIN ───────────────
		const ribbonChildren: SVGElement[] = [];
		for (const { ribbon, shape } of measured) {
			const isHot = hotRibbon === ribbon.id;
			const fill = isHot ? tone.hotOf(ribbon) : tone.fillOf(ribbon);
			const group = document.createElementNS(NS, "g");
			group.setAttribute("data-ribbon", shape.id);
			group.setAttribute("data-hot", isHot ? "true" : "false");
			for (const connector of shape.connectors) {
				const path = document.createElementNS(NS, "path");
				path.setAttribute("d", connector.path);
				path.setAttribute("fill", fill);
				path.setAttribute("stroke", "none");
				group.append(path);
			}
			if (shape.caption !== null && shape.label !== null) {
				const text = document.createElementNS(NS, "text");
				text.setAttribute("x", String(shape.caption.x));
				text.setAttribute("y", String(shape.caption.y));
				text.setAttribute("text-anchor", "middle");
				text.setAttribute("font-size", "10");
				text.setAttribute("font-family", theme.mono);
				text.setAttribute("fill", isHot ? theme.text : theme.dim);
				text.setAttribute("data-caption", shape.id);
				text.textContent = shape.label;
				group.append(text);
			}
			ribbonChildren.push(group);
		}
		ribbonLayer.current.replaceChildren(...ribbonChildren);
	}, [root, layer, columns, ribbons, tone, theme, rowHeight, bandGap, hotRibbon, hotRows]);

	// Paint after every commit (hover, pick, reveal) and whenever the layout
	// revision bumps. Reading the live DOM inside paint makes this race-free.
	useLayoutEffect(() => {
		paint();
	}, [paint, revision]);

	return paint;
};
