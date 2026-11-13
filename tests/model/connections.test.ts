import { describe, expect, it } from "vitest";
import { buildConnections, type RowLink } from "../../connections/group.js";

// The id → connectionId grouping. Consecutive rows with the same group key become
// ONE connection whose ends collapse the cells of every column. No column is
// special: "0"/"1" or "left"/"merge"/"right" behave the same. This is the contract
// the utils/entities lanes and a git/merge hunk both stand on.

const row = (group: string | null, cells: Record<string, string>, extra: Partial<RowLink> = {}): RowLink => ({ group, cells, ...extra });

describe("buildConnections", () => {
	it("groups consecutive same-key rows into one connection", () => {
		const rows = [row("g", { "0": "1", "1": "10" }), row("g", { "0": "2", "1": "11" }), row("g", { "0": "3", "1": "12" })];
		const conns = buildConnections(rows);
		expect(conns.length).toBe(1);
		expect(conns[0]?.ends.find((e) => e.column === "0")?.items).toEqual(["1", "2", "3"]);
		expect(conns[0]?.ends.find((e) => e.column === "1")?.items).toEqual(["10", "11", "12"]);
	});

	it("starts a new connection when the key changes", () => {
		const rows = [row("a", { "0": "1" }), row("b", { "0": "2" })];
		expect(buildConnections(rows).length).toBe(2);
	});

	it("a null key breaks the run", () => {
		const rows = [row("a", { "0": "1" }), row(null, { "0": "2" }), row("a", { "0": "3" })];
		expect(buildConnections(rows).length).toBe(2);
	});

	it("a folded row extends the open band without starting one", () => {
		const rows = [row("a", { "0": "1" }), row(null, {}, { extend: true }), row("a", { "0": "3" })];
		const conns = buildConnections(rows);
		expect(conns.length).toBe(1);
		expect(conns[0]?.ends[0]?.items).toEqual(["1", "3"]);
	});

	it("differs tone wins over the whole band", () => {
		const rows = [row("a", { "0": "1" }, { tone: "same" }), row("a", { "0": "2" }, { tone: "differs" })];
		expect(buildConnections(rows)[0]?.tone).toBe("differs");
	});

	it("works with arbitrary column ids (3-way merge)", () => {
		const rows = [row("hunk", { left: "1", merge: "1", right: "1" })];
		const conns = buildConnections(rows);
		expect(conns[0]?.ends.map((e) => e.column).sort()).toEqual(["left", "merge", "right"]);
	});

	it("applies a caption from the real span", () => {
		const rows = [row("a", { "0": "1" }), row("a", { "0": "2" })];
		const conns = buildConnections(rows, (from, to) => `rows ${from}-${to}`);
		expect(conns[0]?.label).toBe("rows 0-1");
	});

	it("drops a band that holds no cell", () => {
		const rows = [row("a", {})];
		expect(buildConnections(rows).length).toBe(0);
	});
});