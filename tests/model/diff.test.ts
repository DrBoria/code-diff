import { describe, expect, it } from "vitest";
import { diffLines, diffWords } from "../../rows/diff.js";

// The diff engine aligns two texts into rows (LCS over lines) and, inside a
// changed row, an LCS over tokens. These lock the core alignment behaviour.

describe("diffLines", () => {
	it("marks equal lines as equal", () => {
		const { rows } = diffLines({ startLine: 1, lines: ["a", "b"] }, { startLine: 1, lines: ["a", "b"] });
		expect(rows.every((r) => r.type === "equal")).toBe(true);
	});

	it("detects a changed line as one change row (not delete+add)", () => {
		const { rows, counts } = diffLines({ startLine: 1, lines: ["const x = 1;"] }, { startLine: 1, lines: ["const x = 2;"] });
		expect(counts.change).toBe(1);
		expect(rows[0]?.type).toBe("change");
	});

	it("detects pure additions and removals", () => {
		const { counts } = diffLines({ startLine: 1, lines: ["a"] }, { startLine: 1, lines: ["a", "b"] });
		expect(counts.add).toBe(1);
		const removed = diffLines({ startLine: 1, lines: ["a", "b"] }, { startLine: 1, lines: ["a"] });
		expect(removed.counts.remove).toBe(1);
	});

	it("folds long equal runs with context", () => {
		const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`);
		const { rows } = diffLines({ startLine: 1, lines }, { startLine: 1, lines }, { context: 3 });
		expect(rows.some((r) => r.type === "fold")).toBe(true);
	});
});

describe("diffWords", () => {
	it("marks only the differing token", () => {
		const [a, b] = diffWords("const x = 1;", "const x = 2;");
		expect(a.some((w) => w.changed && w.text.includes("1"))).toBe(true);
		expect(b.some((w) => w.changed && w.text.includes("2"))).toBe(true);
		expect(a.filter((w) => !w.changed).map((w) => w.text).join("")).toContain("const x =");
	});
});
