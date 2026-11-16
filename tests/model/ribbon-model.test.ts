import { describe, expect, it } from "vitest";
import { diffLines } from "../../rows/diff.js";
import { resolveLanes, locate, rangeOf, pairTwins, buildConnections, type KeyedMark, type MemberLink, type MarkRow } from "../../ribbon/ribbon-model.js";

// The model says WHICH members correspond; the view finds WHERE and pairs the
// duplicate ranges. These lock the entities/utils-style behaviour.

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
		expect(locate({ rows, column: 0, name: "id" })?.line).toBe("2");
	});
});

describe("resolveLanes", () => {
	it("produces a ribbon with two ends and paired anchors", () => {
		const rows = rowsOf(["interface A {", "  id: string;", "}"], ["interface B {", "  id: string;", "}"]);
		const ribbons = resolveLanes(rows, ["0", "1"], [link("id")]);
		expect(ribbons.length).toBe(1);
		const r = ribbons[0];
		expect(r?.ends.length).toBe(2);
		expect(r?.ends[0]?.rows).toEqual(["2"]);
		expect(r?.anchors?.length).toBe(2);
		expect(r?.anchors?.[0]?.duplicate).toBeDefined();
	});

	it("keeps a one-sided link as a one-ended lane (added/removed member)", () => {
		const rows = rowsOf(["interface A {", "  id: string;", "}"], ["interface B {", "}"]);
		const lanes = resolveLanes(rows, ["0", "1"], [link("id")]);
		expect(lanes.length).toBe(1);
		expect(lanes[0]?.ends.length).toBe(1);
		expect(lanes[0]?.anchors?.length).toBe(1);
	});

	it("skips a link whose name is absent on BOTH sides", () => {
		const rows = rowsOf(["interface A {", "}"], ["interface B {", "}"]);
		expect(resolveLanes(rows, ["0", "1"], [link("id")]).length).toBe(0);
	});
});

describe("pairTwins", () => {
	it("pairs the k-th occurrence on each side by key", () => {
		const marks: KeyedMark[] = [
			{ column: "0", line: "1", from: 0, to: 2, name: "id", key: "id" },
			{ column: "1", line: "1", from: 0, to: 2, name: "id", key: "id" },
		];
		const out = pairTwins(marks);
		expect(out[0]?.duplicate?.column).toBe("1");
		expect(out[1]?.duplicate?.column).toBe("0");
	});
});

describe("buildConnections", () => {
	it("groups consecutive rows with the same key into one ribbon", () => {
		const ribbons = buildConnections([
			{ group: "g", cells: { "0": "1", "1": "1" } },
			{ group: "g", cells: { "0": "2", "1": "2" } },
			{ group: null, cells: {} },
		]);
		expect(ribbons.length).toBe(1);
		expect(ribbons[0]?.ends.find((e) => e.column === "0")?.rows).toEqual(["1", "2"]);
	});
});
