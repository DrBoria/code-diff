// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { renderBoard, codeColumn } from "./helpers.js";
import type { BoardAction, Ribbon } from "../../index.js";

// A 3-way merge is three columns + ribbons + connector actions. The board reports
// the action; an external controller (here a useState) performs the merge and the
// result column genuinely re-renders. This proves the generic merge workflow.

const hunk = (id: string): Ribbon => ({
	id,
	tone: "changed",
	ends: [
		{ column: "left", rows: ["1"] },
		{ column: "result", rows: ["1"] },
		{ column: "right", rows: ["1"] },
	],
});

const MergeController = ({ onApply }: { onApply: (hunk: string, side: "left" | "right") => void }) => {
	const [result, setResult] = useState("base");
	const actions: BoardAction[] = [
		{ id: "apply-left", label: "Apply left", entity: "ribbon", placement: "connector", onClick: (p) => { if (p.ribbon) { onApply(p.ribbon.id, "left"); setResult("left-value"); } } },
		{ id: "apply-right", label: "Apply right", entity: "ribbon", placement: "connector", onClick: (p) => { if (p.ribbon) { onApply(p.ribbon.id, "right"); setResult("right-value"); } } },
	];
	return renderBoard({
		columns: [codeColumn("left", ["left-value"]), codeColumn("result", [result]), codeColumn("right", ["right-value"])],
		ribbons: [hunk("h1")],
		actions,
		corridors: [60, 60],
	});
};

describe("3-way merge via connector actions + external state", () => {
	it("renders left / result / right columns", () => {
		render(<MergeController onApply={() => {}} />);
		expect(document.querySelectorAll("[data-column]").length).toBe(3);
		expect(document.querySelector('[data-column="result"]')).toBeTruthy();
	});

	it("apply-left mutates the result column (real re-render)", () => {
		const onApply = vi.fn();
		render(<MergeController onApply={onApply} />);
		const resultBefore = document.querySelector('[data-column="result"] [data-item="1"]')?.textContent;
		expect(resultBefore).toContain("base");
		fireEvent.click(document.querySelector('[data-action="apply-left"]') as Element);
		expect(onApply).toHaveBeenCalledWith("h1", "left");
		const resultAfter = document.querySelector('[data-column="result"] [data-item="1"]')?.textContent;
		expect(resultAfter).toContain("left-value");
	});

	it("apply-right mutates the result column", () => {
		const onApply = vi.fn();
		render(<MergeController onApply={onApply} />);
		fireEvent.click(document.querySelector('[data-action="apply-right"]') as Element);
		expect(onApply).toHaveBeenCalledWith("h1", "right");
		expect(document.querySelector('[data-column="result"] [data-item="1"]')?.textContent).toContain("right-value");
	});
});
