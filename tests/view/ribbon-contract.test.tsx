// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { renderBoard, codeColumn, theme } from "./helpers.js";
import type { Ribbon } from "../../index.js";

// THE RIBBON IS ONE ENTITY, committed to the DOM: each ribbon is ONE path
// covering its rows and the corridor; no separate band elements exist; hover
// paints the whole ribbon in one hot shade; word marks are the only other
// highlight on the code.

const ribbons: Ribbon[] = [
	{ id: "m1", tone: "duplicate", ends: [{ column: "0", rows: ["1"] }, { column: "1", rows: ["1"] }] },
	{ id: "m2", tone: "duplicate", ends: [{ column: "0", rows: ["2"] }, { column: "1", rows: ["2"] }] },
];

const board = () => render(renderBoard({ columns: [codeColumn("0", ["a", "b", "c"]), codeColumn("1", ["a", "b", "c"])], ribbons, config: { foldUnconnected: false } }));
const dup = theme.colors?.duplicate;

describe("one-entity ribbon DOM", () => {
	it("each ribbon is exactly ONE path; no data-band elements exist", () => {
		board();
		for (const g of [...document.querySelectorAll("[data-ribbon]")]) {
			expect(g.querySelectorAll("path").length).toBe(1);
		}
		expect(document.querySelectorAll("[data-band]").length).toBe(0);
	});

	it("no row carries a background wash of its own", () => {
		board();
		for (const host of [...document.querySelectorAll("[data-row-host]")]) {
			const row = host.firstElementChild;
			const bg = row instanceof HTMLElement ? getComputedStyle(row).backgroundColor : "";
			expect(bg === "" || bg === "transparent" || bg === "rgba(0, 0, 0, 0)").toBe(true);
		}
	});

	it("hover paints the hovered ribbon's ONE path in the hot shade; others stay standing", () => {
		board();
		fireEvent.pointerOver(document.querySelector('[data-ribbon="m2"]') as Element);
		expect(document.querySelector('[data-ribbon="m2"] path')?.getAttribute("fill")).toBe(dup?.hot);
		expect(document.querySelector('[data-ribbon="m1"] path')?.getAttribute("fill")).toBe(dup?.fill);
		expect(document.querySelectorAll("[data-band]").length).toBe(0);
	});

	it("a one-sided member is ONE path (row + tongue), no second element", () => {
		const oneSided: Ribbon[] = [{ id: "solo", tone: "unique", ends: [{ column: "0", rows: ["1"] }] }];
		render(renderBoard({ columns: [codeColumn("0", ["a", "b"]), codeColumn("1", ["a", "b"])], ribbons: oneSided, config: { foldUnconnected: false } }));
		const g = document.querySelector('[data-ribbon="solo"]') as SVGGElement;
		expect(g).toBeTruthy();
		expect(g.querySelectorAll("path").length).toBe(1);
		expect(document.querySelectorAll("[data-band]").length).toBe(0);
	});
});
