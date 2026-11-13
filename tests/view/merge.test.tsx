// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { renderBoard, codeColumn } from "./helpers.js";
import type { Connection } from "../../interface/types.js";

// A 3-way merge is just three columns + connections. code-diff performs NO merge:
// an external controller receives the clicks and decides apply-left / apply-right
// / apply-both. These prove the view reports enough for a controller to act, and
// that the same component renders a git tree comparison via a custom renderer.

const hunk = (id: string): Connection => ({
	id,
	tone: "differs",
	ends: [
		{ column: "left", items: ["1"] },
		{ column: "merge", items: ["1"] },
		{ column: "right", items: ["1"] },
	],
});

// A controller that records which side was applied for a hunk. The view only
// reports the connection click; the controller owns the merge decision.
const MergeController = ({ onApply }: { onApply: (hunk: string, side: "left" | "right" | "both") => void }) => {
	const [connections] = useState<Connection[]>([hunk("h1")]);
	return renderBoard({
		columns: [codeColumn("left", ["a"]), codeColumn("merge", ["a"]), codeColumn("right", ["b"])],
		connections,
		controller: {
			onConnectionClick: (c) => onApply(c.id, "both"),
			onRowClick: (ref) => {
				if (ref.column === "left") onApply("h1", "left");
				if (ref.column === "right") onApply("h1", "right");
			},
		},
	});
};

describe("3-way merge via an external controller", () => {
	it("renders left / merge / right columns", () => {
		render(<MergeController onApply={() => {}} />);
		expect(document.querySelectorAll("[data-column]").length).toBe(3);
		expect(document.querySelector('[data-column="merge"]')).toBeTruthy();
	});

	it("apply-left: clicking the left row reports the left side", () => {
		const onApply = vi.fn();
		render(<MergeController onApply={onApply} />);
		fireEvent.click(document.querySelector('[data-column="left"] [data-item="1"]') as Element);
		expect(onApply).toHaveBeenCalledWith("h1", "left");
	});

	it("apply-right: clicking the right row reports the right side", () => {
		const onApply = vi.fn();
		render(<MergeController onApply={onApply} />);
		fireEvent.click(document.querySelector('[data-column="right"] [data-item="1"]') as Element);
		expect(onApply).toHaveBeenCalledWith("h1", "right");
	});

	it("apply-both: clicking the hunk ribbon reports the whole connection", () => {
		const onApply = vi.fn();
		render(<MergeController onApply={onApply} />);
		const lane = document.querySelector("[data-lane]");
		expect(lane).toBeTruthy();
		fireEvent.click(lane as Element);
		expect(onApply).toHaveBeenCalledWith("h1", "both");
	});
});

describe("git tree comparison via a custom renderer", () => {
	it("renders non-code columns (file trees) with a custom kind", () => {
		const Tree = ({ column }: { column: { id: string; items?: readonly { id: string; text?: string }[] } }) => (
			<div data-column={column.id}>
				{(column.items ?? []).map((it) => (
					<div key={it.id} data-item={it.id} data-anchor={it.id}>
						{it.text}
					</div>
				))}
			</div>
		);
		render(
			renderBoard({
				columns: [
					{ id: "tree-a", kind: "tree", items: [{ id: "src/x.ts", text: "src/x.ts" }] },
					{ id: "tree-b", kind: "tree", items: [{ id: "src/y.ts", text: "src/y.ts" }] },
				],
				renderers: { tree: Tree as never },
			}),
		);
		expect(document.querySelector('[data-column="tree-a"]')).toBeTruthy();
		expect(document.querySelector('[data-column="tree-b"]')).toBeTruthy();
	});
});