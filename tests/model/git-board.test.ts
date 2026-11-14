import { describe, expect, it } from "vitest";
import { gitBoard } from "../../demo/git-board.js";

// The git "as was / as now" adapter: a two-sided line diff turned into board
// columns + one ribbon per changed hunk. These lock the behaviour verified in the
// browser demo: a renamed line is ONE row pair (not delete+add), only the differing
// token is painted, equal rows are named by NO connection (so the view folds them),
// and each contiguous changed run becomes a single connection.

const leftItems = (b: ReturnType<typeof gitBoard>) => b.columns[0]?.items ?? [];
const rightItems = (b: ReturnType<typeof gitBoard>) => b.columns[1]?.items ?? [];

describe("gitBoard", () => {
	it("emits two mirrored code columns", () => {
		const b = gitBoard("a\nb", "a\nc");
		expect(b.columns.map((c) => c.id)).toEqual(["left", "right"]);
		expect(b.columns[0]?.mirrored).toBe(true);
		expect(b.columns.every((c) => c.kind === "items")).toBe(true);
	});

	it("pairs a renamed line as one row on each side, not delete+add", () => {
		const b = gitBoard("const money = 1", "const cash = 1");
		expect(b.counts.change).toBe(1);
		expect(b.counts.add).toBe(0);
		expect(b.counts.remove).toBe(0);
		expect(leftItems(b)).toHaveLength(1);
		expect(rightItems(b)).toHaveLength(1);
		expect(b.connections).toHaveLength(1);
		expect(b.connections[0]?.ends.map((e) => e.column)).toEqual(["left", "right"]);
	});

	it("paints only the differing token on a changed line", () => {
		const b = gitBoard("const money = 1", "const cash = 1");
		const painted = (rightItems(b)[0]?.segments ?? []).filter((s) => s.paint).map((s) => s.text.trim());
		expect(painted).toEqual(["cash"]);
	});

	it("names equal rows by no connection so the view folds them", () => {
		const b = gitBoard("a\nb\nc\nd\ne", "a\nb\nX\nd\ne");
		const linked = new Set(b.connections.flatMap((c) => c.ends.flatMap((e) => e.items)));
		const equalLeft = leftItems(b).filter((i) => !i.tone);
		expect(equalLeft.length).toBeGreaterThan(0);
		expect(equalLeft.every((i) => !linked.has(i.id))).toBe(true);
	});

	it("keeps real line numbers on the plates", () => {
		const b = gitBoard("a\nb\nc\nd\ne", "a\nb\nX\nd\ne");
		const changed = leftItems(b).find((i) => i.tone === "differs");
		expect(changed?.plate).toBe("3");
	});

	it("groups a contiguous changed run into ONE ribbon", () => {
		const b = gitBoard("a\nb\nc\nd", "a\nX\nY\nd");
		expect(b.connections).toHaveLength(1);
		expect(b.connections[0]?.ends[0]?.items).toHaveLength(2);
		expect(b.connections[0]?.ends[1]?.items).toHaveLength(2);
	});

	it("splits separated changed runs into separate ribbons", () => {
		const b = gitBoard("a\nb\nc\nd\ne", "X\nb\nc\nd\nY");
		expect(b.connections).toHaveLength(2);
	});

	it("handles a pure addition as a one-sided hunk", () => {
		const b = gitBoard("a\nb", "a\nb\nc");
		expect(b.counts.add).toBe(1);
		const conn = b.connections[0];
		expect(conn?.ends.some((e) => e.column === "right")).toBe(true);
		expect(conn?.ends.some((e) => e.column === "left")).toBe(false);
	});

	it("handles identical input as no connections", () => {
		const b = gitBoard("a\nb\nc", "a\nb\nc");
		expect(b.connections).toHaveLength(0);
		expect(leftItems(b)).toHaveLength(3);
	});
});
