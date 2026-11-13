import { describe, expect, it } from "vitest";
import { diffLines, diffWords } from "../../rows/lines.js";

// The line/word alignment every comparison view stands on. These lock the
// behaviour the utils/entities reports were built against: a renamed line is a
// CHANGE at the same row (not delete+add), only the differing token is marked,
// and long equal runs fold with context kept at both ends.

const span = (startLine: number, lines: string[]) => ({ startLine, lines });

describe("diffLines", () => {
	it("marks identical lines equal and keeps their line numbers", () => {
		const { rows } = diffLines(span(1, ["a", "b", "c"]), span(1, ["a", "b", "c"]));
		expect(rows.every((r) => r.type === "equal")).toBe(true);
		expect(rows[0]?.cells[0]?.no).toBe(1);
		expect(rows[2]?.cells[1]?.no).toBe(3);
	});

	it("pairs a renamed line as one change row, not delete+add", () => {
		const { rows, counts } = diffLines(span(1, ["const money = 1"]), span(1, ["const cash = 1"]));
		expect(counts.change).toBe(1);
		expect(counts.add).toBe(0);
		expect(counts.remove).toBe(0);
		expect(rows[0]?.type).toBe("change");
	});

	it("word-diffs a change row so only the differing token is marked", () => {
		const { rows } = diffLines(span(1, ["const money = 1"]), span(1, ["const cash = 1"]));
		const left = rows[0]?.cells[0]?.words ?? [];
		const changed = left.filter((w) => w.changed).map((w) => w.text.trim());
		expect(changed).toEqual(["money"]);
	});

	it("reports a one-sided line as add or remove", () => {
		const { counts } = diffLines(span(1, ["a", "b"]), span(1, ["a", "b", "c"]));
		expect(counts.add).toBe(1);
		expect(counts.remove).toBe(0);
	});

	it("keeps different start line numbers per side", () => {
		const { rows } = diffLines(span(10, ["x"]), span(40, ["x"]));
		expect(rows[0]?.cells[0]?.no).toBe(10);
		expect(rows[0]?.cells[1]?.no).toBe(40);
	});

	it("folds a long equal run, keeping context at both ends", () => {
		const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`);
		const { rows } = diffLines(span(1, lines), span(1, lines), { context: 3 });
		const folds = rows.filter((r) => r.type === "fold");
		expect(folds.length).toBe(1);
		// 3 context + fold + 3 context
		expect(rows.length).toBe(7);
		expect(folds[0]?.rows?.length).toBe(24);
	});

	it("does not fold a short run", () => {
		const lines = ["a", "b", "c", "d", "e"];
		const { rows } = diffLines(span(1, lines), span(1, lines), { context: 3 });
		expect(rows.some((r) => r.type === "fold")).toBe(false);
	});
});

describe("diffWords", () => {
	it("splits a changed line into changed and unchanged runs", () => {
		const [left, right] = diffWords("save(id: string)", "save(id: number)");
		expect(left.filter((w) => w.changed).map((w) => w.text)).toEqual(["string"]);
		expect(right.filter((w) => w.changed).map((w) => w.text)).toEqual(["number"]);
	});

	it("falls back to whole-line changed above the token limit", () => {
		const big = Array.from({ length: 500 }, (_, i) => `t${i}`).join(" ");
		const [left] = diffWords(big, "x", 400);
		expect(left.length).toBe(1);
		expect(left[0]?.changed).toBe(true);
	});
});