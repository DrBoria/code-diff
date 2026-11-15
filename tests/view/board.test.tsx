// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderBoard, codeColumn } from "./helpers.js";
import type { BoardAction, Connection, RowRef } from "../../interface/types.js";

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

describe("a ribbon is the same band as the row wash", () => {
	it("fills the ribbon in the row wash colour, hot or not — never a thin wire, never a brighter slab", () => {
		const connection: Connection = { id: "c", tone: "same", ends: [{ column: "left", items: ["1"] }, { column: "right", items: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], connections: [connection] }));
		const lane = document.querySelector('[data-lane="c"]') as SVGGElement;
		expect(lane).toBeTruthy();
		const paths = [...lane.querySelectorAll("path")];
		// One ribbon between two columns → one filled band.
		expect(paths.length).toBe(1);
		// The road is FILLED in the tone's wash colour (`fill`), the SAME colour as the
		// rows it joins — never a stroke, never a brighter `line`/`lineHot` shade.
		expect(paths[0]?.getAttribute("fill")).toBe("rgba(255,107,107,0.1)");
		expect(paths[0]?.getAttribute("stroke")).toBe("none");
		// Hover the lane: the ribbon stays the SAME colour (hover lights the row wash,
		// not the road). A road that changes shade on hover is a different road.
		fireEvent.pointerOver(lane);
		const hot = [...lane.querySelectorAll("path")];
		expect(hot[0]?.getAttribute("fill")).toBe("rgba(255,107,107,0.1)");
	});
});

describe("external actions (the controller decides what a click means)", () => {
	it("onRowClick REPLACES the built-in filter", () => {
		const onRowClick = vi.fn();
		const onPick = vi.fn();
		const connection: Connection = { id: "c", ends: [{ column: "left", items: ["1"] }, { column: "right", items: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], connections: [connection], controller: { onRowClick, onPick } }));
		fireEvent.click(document.querySelector('[data-column="left"] [data-item="1"]') as Element);
		expect(onRowClick).toHaveBeenCalledWith({ column: "left", item: "1" });
		// The built-in pick did NOT run: the owner replaced it.
		expect(onPick).not.toHaveBeenCalled();
	});

	it("draws a row action button and reports the click with the row and selection", () => {
		const onAction = vi.fn();
		const action: BoardAction = { id: "stage", label: "Stage", icon: <span>+</span>, onAction };
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], controller: { actions: [action], selected: [] } }));
		const button = document.querySelector('[data-action="stage"]') as Element;
		expect(button).toBeTruthy();
		fireEvent.click(button);
		expect(onAction).toHaveBeenCalledWith({ column: "left", item: "1" }, []);
	});

	it("draws a toolbar action and reports it with a null row", () => {
		const onAction = vi.fn();
		const action: BoardAction = { id: "apply-left", label: "Apply left", scope: "toolbar", onAction };
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], controller: { actions: [action] } }));
		const button = document.querySelector('[data-action="apply-left"]') as Element;
		expect(button).toBeTruthy();
		fireEvent.click(button);
		expect(onAction).toHaveBeenCalledWith(null, []);
	});

	it("reports onRowHover when the row under the pointer changes", () => {
		const onRowHover = vi.fn();
		render(renderBoard({ columns: [codeColumn("left", ["a", "b"], { fold: false })], controller: { onRowHover } }));
		fireEvent.pointerOver(document.querySelector('[data-column="left"] [data-item="1"]') as Element);
		expect(onRowHover).toHaveBeenCalledWith({ column: "left", item: "1" });
	});
});

describe("selection (independent of the focused chain)", () => {
	it("draws a selection mark on selected rows and reports a toggle", () => {
		const onSelect = vi.fn();
		const selected: RowRef[] = [{ column: "left", item: "1" }];
		render(renderBoard({ columns: [codeColumn("left", ["a", "b"], { fold: false })], controller: { selected, onSelect } }));
		// Row 1 is selected: its checkbox is checked.
		const boxes = [...document.querySelectorAll('[data-action="select"]')];
		expect(boxes.length).toBe(2);
		expect(boxes[0]?.textContent).toBe("✓");
		expect(boxes[1]?.textContent).toBe("");
		// Clicking row 2's checkbox adds it to the selection.
		fireEvent.click(boxes[1] as Element);
		expect(onSelect).toHaveBeenCalledWith([{ column: "left", item: "1" }, { column: "left", item: "2" }]);
	});

	it("a selection toggle is not also a row click", () => {
		const onSelect = vi.fn();
		const onRowClick = vi.fn();
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], controller: { selected: [], onSelect, onRowClick } }));
		fireEvent.click(document.querySelector('[data-action="select"]') as Element);
		expect(onSelect).toHaveBeenCalled();
		expect(onRowClick).not.toHaveBeenCalled();
	});
});

describe("controlled reveal (only blocks / show all)", () => {
	it("shows exactly the controller's reveal state and reports a fold-button toggle", () => {
		const onReveal = vi.fn();
		const connection: Connection = { id: "c", ends: [{ column: "left", items: ["2"] }, { column: "right", items: ["2"] }] };
		const { rerender } = render(
			renderBoard({ columns: [codeColumn("left", ["a", "b", "c"]), codeColumn("right", ["a", "b", "c"])], connections: [connection], controller: { reveal: false, onReveal } }),
		);
		// Folded: rows 1 and 3 are hidden behind a fold button; row 2 shows in both columns.
		expect(screen.queryByText("a")).toBeNull();
		expect(screen.getAllByText("b").length).toBe(2);
		// The owner flips the chip to show-all: the board recomputes and shows every row.
		rerender(renderBoard({ columns: [codeColumn("left", ["a", "b", "c"]), codeColumn("right", ["a", "b", "c"])], connections: [connection], controller: { reveal: true, onReveal } }));
		expect(screen.getAllByText("a").length).toBeGreaterThan(0);
		expect(screen.getAllByText("c").length).toBeGreaterThan(0);
	});
});

describe("change explanations (what happened, under the code line)", () => {
	it("draws the change note under the row", () => {
		const columns = [
			{ id: "left", kind: "items" as const, items: [{ id: "1", plate: "1", text: "const money = 1", change: { text: 'replaced "money" with "cash"' } }] },
			{ id: "right", kind: "items" as const, items: [{ id: "1", plate: "1", text: "const cash = 1" }] },
		];
		render(renderBoard({ columns }));
		expect(screen.getByText('replaced "money" with "cash"')).toBeTruthy();
	});
});
