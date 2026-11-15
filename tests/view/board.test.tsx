// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderBoard, codeColumn } from "./helpers.js";
import type { Connection } from "../../interface/types.js";

// The board is a generic N-column view. These verify it renders any number of
// columns with any ids, shows the rows, and reports interactions to a controller
// without performing any merge itself.

describe("N-column rendering", () => {
	it("renders two columns of code (side-by-side / git changes)", () => {
		render(renderBoard({ columns: [codeColumn("left", ["a", "b"]), codeColumn("right", ["a", "c"])] }));
		expect(document.querySelectorAll("[data-column]").length).toBe(2);
		expect(screen.getAllByText("b").length).toBeGreaterThan(0);
		expect(screen.getAllByText("c").length).toBeGreaterThan(0);
	});

	it("renders three columns (3-way merge: left / merge / right)", () => {
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("merge", ["a"]), codeColumn("right", ["a"])] }));
		expect(document.querySelectorAll("[data-column]").length).toBe(3);
	});

	it("renders arbitrary column ids (git tree comparison)", () => {
		render(renderBoard({ columns: [codeColumn("tree-a", ["src/x.ts"]), codeColumn("tree-b", ["src/y.ts"])] }));
		expect(document.querySelector('[data-column="tree-a"]')).toBeTruthy();
		expect(document.querySelector('[data-column="tree-b"]')).toBeTruthy();
	});

	it("shows every row when foldUnconnected is false (git/merge default)", () => {
		render(renderBoard({ columns: [codeColumn("left", ["a", "b", "c"], { fold: false })], options: { foldUnconnected: false } }));
		expect(screen.getAllByText("a").length).toBeGreaterThan(0);
		expect(screen.getAllByText("b").length).toBeGreaterThan(0);
		expect(screen.getAllByText("c").length).toBeGreaterThan(0);
	});
});

describe("controller actions (view only reports, never merges)", () => {
	it("fires onRowClick with the column and item id", () => {
		const onRowClick = vi.fn();
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], controller: { onRowClick } }));
		fireEvent.click(document.querySelector('[data-column="left"] [data-item="1"]') as Element);
		expect(onRowClick).toHaveBeenCalledWith({ column: "left", item: "1" });
	});

	it("fires onConnectionClick with the whole connection on a ribbon click", () => {
		const onConnectionClick = vi.fn();
		const connection: Connection = { id: "hunk-1", ends: [{ column: "left", items: ["1"] }, { column: "right", items: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], connections: [connection], controller: { onConnectionClick } }));
		const lane = document.querySelector("[data-lane]");
		expect(lane).toBeTruthy();
		fireEvent.click(lane as Element);
		expect(onConnectionClick).toHaveBeenCalledWith(connection);
	});

	it("reports a pick through onPick", () => {
		const onPick = vi.fn();
		const connection: Connection = { id: "c", ends: [{ column: "left", items: ["1"] }, { column: "right", items: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], connections: [connection], controller: { onPick } }));
		fireEvent.click(document.querySelector('[data-column="left"] [data-item="1"]') as Element);
		expect(onPick).toHaveBeenCalled();
	});
});

describe("connections name real ids only", () => {
	it("drops a lane that names an id no column carries", () => {
		// `ghost` is not a row of either column: the lane is a road to nowhere and must
		// not be drawn. The real lane (`1`↔`1`) survives.
		const ghost: Connection = { id: "ghost", ends: [{ column: "left", items: ["999"] }, { column: "right", items: ["1"] }] };
		const real: Connection = { id: "real", ends: [{ column: "left", items: ["1"] }, { column: "right", items: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], connections: [ghost, real] }));
		const lanes = [...document.querySelectorAll("[data-lane]")].map((g) => g.getAttribute("data-lane"));
		expect(lanes).toContain("real");
		expect(lanes).not.toContain("ghost");
	});

	it("drops an id a column does not carry but keeps the lane's real ends", () => {
		// The left end names a real row AND a ghost; the ghost is dropped, the lane stays.
		const connection: Connection = { id: "c", ends: [{ column: "left", items: ["1", "999"] }, { column: "right", items: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], connections: [connection] }));
		expect(document.querySelector('[data-lane="c"]')).toBeTruthy();
	});
});

describe("a hot ribbon is one uniform shade", () => {
	it("paints the pointed-at lane ONCE, never the road laid down twice", () => {
		const connection: Connection = { id: "c", tone: "same", ends: [{ column: "left", items: ["1"] }, { column: "right", items: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], connections: [connection] }));
		const lane = document.querySelector('[data-lane="c"]') as SVGGElement;
		expect(lane).toBeTruthy();
		// Hover the lane: it becomes hot. jsdom has no layout, so the ribbon path may be
		// empty — but the lane owns ONE visible stroke per ribbon (plus a transparent
		// hit-area), never a doubled stack of the road itself.
		fireEvent.pointerOver(lane);
		const visible = [...lane.querySelectorAll("path")].filter((p) => p.getAttribute("stroke") !== "transparent");
		// One ribbon between two columns → one visible line, hot or not.
		expect(visible.length).toBeLessThanOrEqual(1);
		// The road is a STROKE, never a filled slab.
		for (const p of visible) expect(p.getAttribute("fill")).toBe("none");
	});
});
