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