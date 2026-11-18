// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { renderBoard, codeColumn } from "./helpers.js";
import type { BoardAction } from "../../index.js";

// Actions are ONE array (MUI/AG Grid/Syncfusion style). The shared Actions
// component renders them for row / column / ribbon, and the board emits
// <entity>:action. These lock the flexible action contract.

describe("row actions", () => {
	it("renders a row action button and emits row:action", () => {
		const onAction = vi.fn();
		const actions: BoardAction[] = [{ id: "stage", label: "Stage", entity: "row", placement: "inside-end", icon: <span>+</span> }];
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], actions, events: { "row:action": onAction } }));
		const btn = document.querySelector('[data-action="stage"]') as Element;
		expect(btn).toBeTruthy();
		fireEvent.click(btn);
		expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ actionId: "stage", row: { column: "left", row: "1" } }), expect.anything());
	});

	it("calls the action's own onClick handler", () => {
		const onClick = vi.fn();
		const actions: BoardAction[] = [{ id: "apply", label: "Apply", entity: "row", placement: "inside-end", onClick }];
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], actions }));
		fireEvent.click(document.querySelector('[data-action="apply"]') as Element);
		expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ entity: "row" }));
	});

	it("respects the disabled predicate", () => {
		const onClick = vi.fn();
		const actions: BoardAction[] = [{ id: "x", label: "X", entity: "row", placement: "inside-end", disabled: () => true, onClick }];
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], actions }));
		const btn = document.querySelector('[data-action="x"]') as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
		fireEvent.click(btn);
		expect(onClick).not.toHaveBeenCalled();
	});

	it("hides an action whose hidden predicate is true", () => {
		const actions: BoardAction[] = [{ id: "secret", label: "Secret", entity: "row", placement: "inside-end", hidden: () => true }];
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], actions }));
		expect(document.querySelector('[data-action="secret"]')).toBeNull();
	});
});

describe("toolbar actions", () => {
	it("renders toolbar-scoped actions in the toolbar", () => {
		const actions: BoardAction[] = [{ id: "apply-all", label: "Apply all", entity: "row", placement: "toolbar" }];
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })], actions }));
		expect(document.querySelector("[data-toolbar]")).toBeTruthy();
		expect(document.querySelector('[data-action="apply-all"]')).toBeTruthy();
	});
});

describe("ribbon connector actions", () => {
	it("renders connector actions for a ribbon", () => {
		const actions: BoardAction[] = [{ id: "apply-left", label: "Apply left", entity: "ribbon", placement: "connector", icon: <span>←</span> }];
		render(renderBoard({
			columns: [codeColumn("left", ["a"]), codeColumn("right", ["a"])],
			ribbons: [{ id: "c", ends: [{ column: "left", rows: ["1"] }, { column: "right", rows: ["1"] }] }],
			actions,
			corridors: [80],
		}));
		expect(document.querySelector('[data-action="apply-left"]')).toBeTruthy();
	});
});

describe("selection checkbox (config.selectable)", () => {
	it("is absent by default — comparison boards select nothing", () => {
		render(renderBoard({ columns: [codeColumn("left", ["a"], { fold: false })] }));
		expect(document.querySelector('[data-action="select"]')).toBeNull();
	});

	it("draws one checkbox per row when selectable, toggling selection without a row click", () => {
		const onSelect = vi.fn();
		const onClick = vi.fn();
		render(renderBoard({
			columns: [codeColumn("left", ["a", "b"], { fold: false })],
			config: { selectable: true },
			events: { "row:select": onSelect, "row:click": onClick },
		}));
		const boxes = document.querySelectorAll('[data-action="select"]');
		expect(boxes.length).toBe(2);
		fireEvent.click(boxes[0] as Element);
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ row: { column: "left", row: "1" }, selected: true }), expect.anything());
		// The checkbox is an action, never a row click (no focus toggle either).
		expect(onClick).not.toHaveBeenCalled();
		// Clicking again deselects.
		fireEvent.click(boxes[0] as Element);
		expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ row: { column: "left", row: "1" }, selected: false }), expect.anything());
	});

	it("shows the controlled selection as checked", () => {
		render(renderBoard({
			columns: [codeColumn("left", ["a", "b"], { fold: false })],
			config: { selectable: true },
			state: { selected: [{ column: "left", row: "2" }] },
		}));
		const boxes = [...document.querySelectorAll('[data-action="select"]')];
		expect((boxes[0] as HTMLElement).textContent).toBe("");
		expect((boxes[1] as HTMLElement).textContent).toBe("✓");
	});
});
