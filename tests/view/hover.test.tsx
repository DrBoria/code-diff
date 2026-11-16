// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { renderBoard, codeColumn } from "./helpers.js";
import type { Column, Ribbon } from "../../index.js";

// HOVER = ONE CHAIN. A batch of independent rows (methods) must not light the
// whole column; a nested group's HEADER lights its members (parent hint), a
// MEMBER lights only its own chain.

const ribbons: Ribbon[] = [
	{ id: "m1", tone: "duplicate", ends: [{ column: "0", rows: ["1"] }, { column: "1", rows: ["1"] }] },
	{ id: "m2", tone: "duplicate", ends: [{ column: "0", rows: ["2"] }, { column: "1", rows: ["2"] }] },
	{ id: "m3", tone: "duplicate", ends: [{ column: "0", rows: ["3"] }, { column: "1", rows: ["3"] }] },
];

const hotIds = (): string[] => [...document.querySelectorAll('[data-ribbon][data-hot="true"]')].map((g) => g.getAttribute("data-ribbon") ?? "");

describe("hover lights ONE chain, not the column", () => {
	it("hovering a row of an independent batch lights only its own ribbon", () => {
		render(renderBoard({ columns: [codeColumn("0", ["a", "b", "c"]), codeColumn("1", ["a", "b", "c"])], ribbons, config: { foldUnconnected: false } }));
		fireEvent.pointerOver(document.querySelector('[data-column="0"] [data-item="2"]') as Element);
		expect(hotIds()).toEqual(["m2"]);
	});

	it("hovering a ribbon lights only that ribbon", () => {
		render(renderBoard({ columns: [codeColumn("0", ["a", "b", "c"]), codeColumn("1", ["a", "b", "c"])], ribbons, config: { foldUnconnected: false } }));
		fireEvent.pointerOver(document.querySelector('[data-ribbon="m3"]') as Element);
		expect(hotIds()).toEqual(["m3"]);
	});

	it("never washes the rows: the backdrop carries ribbons and hints only", () => {
		render(renderBoard({ columns: [codeColumn("0", ["a", "b", "c"]), codeColumn("1", ["a", "b", "c"])], ribbons, config: { foldUnconnected: false } }));
		const svg = document.querySelector("svg") as SVGSVGElement;
		const layer = svg.firstElementChild as SVGGElement;
		expect(layer.childElementCount).toBe(0);
	});
});

describe("group hover: header lights members, member does not", () => {
	const grouped = (id: string): Column => ({
		id,
		rows: [
			{ id: "h", text: "header", group: "g", groupHeader: true },
			{ id: "p1", text: "member one", group: "g", indent: 1 },
			{ id: "p2", text: "member two", group: "g", indent: 1 },
		],
	});

	it("hovering the HEADER paints a group hint on the members", () => {
		render(renderBoard({ columns: [grouped("0"), grouped("1")], config: { foldUnconnected: false } }));
		fireEvent.pointerOver(document.querySelector('[data-column="0"] [data-item="h"]') as Element);
		const hints = [...document.querySelectorAll("[data-group-hint]")].map((p) => p.getAttribute("data-group-hint"));
		expect(hints).toContain("0::p1");
		expect(hints).toContain("0::p2");
		expect(hints).toContain("1::p1");
	});

	it("hovering a MEMBER does NOT light the whole group", () => {
		render(renderBoard({ columns: [grouped("0"), grouped("1")], config: { foldUnconnected: false } }));
		fireEvent.pointerOver(document.querySelector('[data-column="0"] [data-item="p1"]') as Element);
		expect(document.querySelectorAll("[data-group-hint]").length).toBe(0);
	});
});
