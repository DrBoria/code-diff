import { describe, expect, it } from "vitest";
import { diffLines } from "../../rows/lines.js";
import { resolveLanes } from "../../marks/resolve.js";
import { pairTwins, type KeyedMark } from "../../marks/twins.js";
import { locate, rangeOf } from "../../marks/locate.js";
import type { MemberLink, MarkRow } from "../../marks/types.js";

// The model says WHICH members correspond; the view finds WHERE and pairs twins.
// These lock the entities-style behaviour: a shared name is located on its row,
// marked, and paired with its duplicate on the other side.

const rowsOf = (a: string[], b: string[]): MarkRow[] => diffLines({ startLine: 1, lines: a }, { startLine: 1, lines: b }).rows as MarkRow[];

const link = (name: string, extra: Partial<MemberLink> = {}): MemberLink => ({
	connectionId: `same:property:${name}`,
	leftColumn: "0",
	rightColumn: "1",
	left: { name },
	right: { name },
	...extra,
});

describe("rangeOf / locate", () => {
	it("finds a whole-word range", () => {
		expect(rangeOf("  id: string;", "id")).toEqual({ from: 2, to: 4 });
	});

	it("does not match a substring of a longer word", () => {
		expect(rangeOf("identifier: string;", "id")).toBeNull();
	});

	it("locates the row a name is declared on", () => {
		const rows = rowsOf(["interface A {", "  id: string;", "}"], ["interface B {", "  id: string;", "}"]);
		expect(locate(rows, 0, "id")?.line).toBe("2");
	});
});

describe("resolveLanes", () => {
	it("resolves a semantic link into a connection with marks and twins", () => {
		const rows = rowsOf(["interface A {", "  id: string;", "}"], ["interface B {", "  id: string;", "}"]);
		const lanes = resolveLanes(rows, ["0", "1"], [link("id")]);
		expect(lanes.length).toBe(1);
		expect(lanes[0]?.id).toBe("same:property:id");
		expect(lanes[0]?.ends[0]?.items).toEqual(["2"]);
		const left = lanes[0]?.marks.find((m) => m.column === "0");
		expect(left?.twin?.column).toBe("1");
		expect(left?.from).toBe(2);
	});

	it("skips a link whose name is not on screen", () => {
		const rows = rowsOf(["interface A {", "}"], ["interface B {", "}"]);
		expect(resolveLanes(rows, ["0", "1"], [link("ghost")]).length).toBe(0);
	});

	it("pairs repeated names by occurrence", () => {
		const rows = rowsOf(["a: x", "a: y"], ["a: x", "a: y"]);
		const lanes = resolveLanes(rows, ["0", "1"], [link("a"), link("a")]);
		expect(lanes.length).toBe(2);
		// first left 'a' pairs with first right 'a' (line 1), second with line 2
		const firstLeft = lanes[0]?.marks.find((m) => m.column === "0");
		expect(firstLeft?.twin?.line).toBe("1");
	});
});

describe("pairTwins", () => {
	it("pairs by key first, then by name in order", () => {
		const marks: KeyedMark[] = [
			{ column: "0", line: "1", from: 0, to: 1, name: "type", key: "type:dom-action" },
			{ column: "1", line: "1", from: 0, to: 1, name: "type", key: "type:dom-action" },
			{ column: "0", line: "2", from: 0, to: 1, name: "type", key: "type:domResponse" },
			{ column: "1", line: "2", from: 0, to: 1, name: "type", key: "type:domResponse" },
		];
		const out = pairTwins(marks);
		expect(out[0]?.twin?.line).toBe("1");
		expect(out[2]?.twin?.line).toBe("2");
	});

	it("falls back to name-in-order when keys differ", () => {
		const marks: KeyedMark[] = [
			{ column: "0", line: "1", from: 0, to: 1, name: "text", key: "text:Dragged" },
			{ column: "1", line: "1", from: 0, to: 1, name: "text", key: "text:Scrolled" },
		];
		const out = pairTwins(marks);
		expect(out[0]?.twin?.column).toBe("1");
	});
});