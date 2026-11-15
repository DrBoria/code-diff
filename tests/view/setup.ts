// jsdom lacks ResizeObserver and real layout. Provide stand-ins so the virtual
// list and measure hooks run, and give every element a deterministic box so the
// ribbon geometry can measure rows (jsdom getBoundingClientRect is all-zero).
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

class ResizeObserverStub {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}
(globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverStub;

if (typeof window !== "undefined" && !window.matchMedia) {
	(window as Record<string, unknown>).matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	}));
}

// Deterministic layout: each [data-column] is a 300px-wide column laid out left
// to right with an 80px corridor; each [data-anchor] row is 18px tall stacked by
// its index within the column. This lets measureLayout produce real boxes.
const ROW = 18;
const COLW = 300;
const GAP = 80;
if (typeof Element !== "undefined") {
	Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
		const el = this as HTMLElement;
		const col = el.closest?.("[data-column]") as HTMLElement | null;
		const columns = el.ownerDocument ? Array.from(el.ownerDocument.querySelectorAll("[data-column]")) : [];
		const colIndex = col ? columns.indexOf(col) : 0;
		const isColumn = el.hasAttribute?.("data-column");
		const isRow = el.hasAttribute?.("data-anchor");
		let top = 0;
		let left = 0;
		let width = COLW;
		let height = ROW;
		if (isColumn) {
			left = Math.max(0, colIndex) * (COLW + GAP);
			height = 1000;
		} else if (isRow && col) {
			const rows = Array.from(col.querySelectorAll("[data-anchor]"));
			const rowIndex = rows.indexOf(el);
			left = Math.max(0, colIndex) * (COLW + GAP);
			top = Math.max(0, rowIndex) * ROW;
		} else {
			width = 1200;
			height = 1000;
		}
		return { top, left, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
	};
}

afterEach(() => {
	cleanup();
});
