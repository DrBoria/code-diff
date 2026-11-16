// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderBoard, codeColumn } from "./helpers.js";
import type { Ribbon } from "../../index.js";

// The board is a generic N-column view driven by ONE events map and ONE actions
// array. These verify rendering, the event catalog, and the uniform ribbon chain.

describe("N-column rendering", () => {
	it("renders two columns of code", () => {
		render(renderBoard({ columns: [codeColumn("left", ["a", "b"]), codeColumn("right", ["a", "c"])] }));
		expect(document.querySelectorAll("[data-column]").length).toBe(2);
		expect(screen.getAllByText("b").length).toBeGreaterThan(0);
		expect(screen.getAllByText("c").length).toBeGreaterThan(0);
	});

	it("renders three columns (3-way merge)", () => {
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("merge", ["a"]), codeColumn("right", ["a"])] }));
		expect(document.querySelectorAll("[data-column]").length).toBe(3);
	});

	it("shows every row when foldUnconnected is false", () => {
		render(renderBoard({ columns: [codeColumn("left", ["a", "b", "c"], { fold: false })], config: { foldUnconnected: false } }));
		expect(screen.getAllByText("a").length).toBeGreaterThan(0);
		expect(screen.getAllByText("c").length).toBeGreaterThan(0);
	});
});

describe("events catalog (one map, not per-event props)", () => {
	it("emits row:click with the row ref", () => {
		const onClick = vi.fn();
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], events: { "row:click": onClick } }));
		fireEvent.click(document.querySelector('[data-column="left"] [data-item="1"]') as Element);
		expect(onClick).toHaveBeenCalledWith({ row: { column: "left", row: "1" } }, expect.objectContaining({ defaultPrevented: false }));
	});

	it("preventDefault on row:click suppresses the built-in focus", () => {
		const onFocus = vi.fn();
		render(renderBoard({
			columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])],
			ribbons: [{ id: "c", ends: [{ column: "left", rows: ["1"] }, { column: "right", rows: ["1"] }] }],
			events: { "row:click": (_p, e) => e.preventDefault(), "ribbon:focus": onFocus },
		}));
		fireEvent.click(document.querySelector('[data-column="left"] [data-item="1"]') as Element);
		expect(onFocus).not.toHaveBeenCalled();
	});

	it("emits ribbon:click on a ribbon click", () => {
		const onClick = vi.fn();
		const ribbon: Ribbon = { id: "hunk-1", ends: [{ column: "left", rows: ["1"] }, { column: "right", rows: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], ribbons: [ribbon], events: { "ribbon:click": onClick } }));
		const lane = document.querySelector("[data-ribbon]");
		expect(lane).toBeTruthy();
		fireEvent.click(lane as Element);
		expect(onClick).toHaveBeenCalled();
	});
});

describe("ribbons name real ids only", () => {
	it("draws a one-ended stub when one side's id is absent (not a two-ended road)", () => {
		const ghost: Ribbon = { id: "ghost", ends: [{ column: "left", rows: ["999"] }, { column: "right", rows: ["1"] }] };
		const real: Ribbon = { id: "real", ends: [{ column: "left", rows: ["1"] }, { column: "right", rows: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], ribbons: [ghost, real] }));
		const stub = document.querySelector('[data-ribbon="ghost"]') as SVGGElement;
		expect(stub).toBeTruthy();
		expect(stub.querySelectorAll("path").length).toBe(1);
		const lanes = [...document.querySelectorAll("[data-ribbon]")].map((g) => g.getAttribute("data-ribbon"));
		expect(lanes).toContain("real");
	});

	it("drops a ribbon whose every id is absent", () => {
		const gone: Ribbon = { id: "gone", ends: [{ column: "left", rows: ["999"] }, { column: "right", rows: ["999"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], ribbons: [gone] }));
		expect(document.querySelector('[data-ribbon="gone"]')).toBeNull();
	});
});

describe("a ribbon is one uniform filled band", () => {
	it("fills the ribbon in the tone colour, stroke none", () => {
		const ribbon: Ribbon = { id: "c", tone: "duplicate", ends: [{ column: "left", rows: ["1"] }, { column: "right", rows: ["1"] }] };
		render(renderBoard({ columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])], ribbons: [ribbon] }));
		const lane = document.querySelector('[data-ribbon="c"]') as SVGGElement;
		expect(lane).toBeTruthy();
		const path = lane.querySelector("path");
		expect(path?.getAttribute("stroke")).toBe("none");
		expect(path?.getAttribute("fill")).toContain("rgba");
	});
});
