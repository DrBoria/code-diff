// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { renderBoard, codeColumn, theme } from "./helpers.js";
import type { Ribbon } from "../../index.js";

// THE RIBBON CONTRACT, committed to the DOM: the road AND its row bands are
// painted in ONE shade; hover paints the whole chain (bands included) and
// NOTHING outside it; a row carries no wash of its own. These assertions are
// the rules — a complaint about washes is not a licence to delete the bands.

const ribbons: Ribbon[] = [
	{ id: "m1", tone: "duplicate", ends: [{ column: "0", rows: ["1"] }, { column: "1", rows: ["1"] }] },
	{ id: "m2", tone: "duplicate", ends: [{ column: "0", rows: ["2"] }, { column: "1", rows: ["2"] }] },
];

const board = () => render(renderBoard({ columns: [codeColumn("0", ["a", "b", "c"]), codeColumn("1", ["a", "b", "c"])], ribbons, config: { foldUnconnected: false } }));
const fillsOf = (sel: string): string[] => [...document.querySelectorAll(sel)].map((p) => p.getAttribute("fill") ?? "");
const dup = theme.colors?.duplicate;

describe("contract DOM: one chain, one shade, bands included", () => {
	it("standing: each chain's bands and road share ONE fill", () => {
		board();
		expect(fillsOf('[data-band]').length).toBe(4);
		for (const fill of fillsOf('[data-band], [data-ribbon] path')) expect(fill).toBe(dup?.fill);
	});

	it("hover paints bands AND road in the ONE hot shade", () => {
		board();
		fireEvent.pointerOver(document.querySelector('[data-ribbon="m2"]') as Element);
		const hot = fillsOf('[data-ribbon="m2"] path, [data-band="1::2"], [data-band="0::2"]');
		expect(hot.length).toBe(3);
		for (const fill of hot) expect(fill).toBe(dup?.hot);
	});

	it("hover never paints anything outside its chain", () => {
		board();
		fireEvent.pointerOver(document.querySelector('[data-ribbon="m2"]') as Element);
		for (const fill of fillsOf('[data-band="0::1"], [data-band="1::1"], [data-ribbon="m1"] path')) expect(fill).toBe(dup?.fill);
		expect(document.querySelectorAll("[data-group-hint]").length).toBe(0);
	});

	it("no row carries a background wash of its own", () => {
		board();
		for (const host of [...document.querySelectorAll("[data-row-host]")]) {
			const row = host.firstElementChild;
			const bg = row instanceof HTMLElement ? getComputedStyle(row).backgroundColor : "";
			expect(bg === "" || bg === "transparent" || bg === "rgba(0, 0, 0, 0)").toBe(true);
		}
	});
});
