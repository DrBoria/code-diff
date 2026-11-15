import { describe, expect, it } from "vitest";
import { adaptLegacyBoard, adaptLegacyTones, adaptLegacyTheme } from "../../board/legacy.js";

// The legacy adapter bridges the historical domain shape (items / connections /
// blocks / tones) into the current contract (rows / ribbons / theme.colors). It
// must accept BOTH legacy ends.items and new ends.rows without losing data.

describe("adaptLegacyBoard", () => {
	it("maps legacy items to rows and connections to ribbons", () => {
		const { columns, ribbons } = adaptLegacyBoard({
			columns: [{ id: "0", items: [{ id: "1", text: "a", plate: "1" }] }, { id: "1", items: [{ id: "1", text: "b" }] }],
			connections: [{ id: "c", tone: "same", ends: [{ column: "0", items: ["1"] }, { column: "1", items: ["1"] }] }],
		});
		expect(columns[0]?.rows?.[0]?.text).toBe("a");
		expect(ribbons[0]?.ends[0]?.rows).toEqual(["1"]);
	});

	it("preserves new-shape ends.rows (resolveLanes output)", () => {
		const { ribbons } = adaptLegacyBoard({
			columns: [{ id: "0", items: [{ id: "1" }] }, { id: "1", items: [{ id: "1" }] }],
			connections: [{ id: "c", ends: [{ column: "0", rows: ["1"] }, { column: "1", rows: ["1"] }], anchors: [{ column: "0", line: "1", from: 0, to: 1 }] }],
		});
		expect(ribbons[0]?.ends[0]?.rows).toEqual(["1"]);
		expect(ribbons[0]?.anchors?.length).toBe(1);
	});

	it("turns blocks into row groups with a header flag", () => {
		const { columns } = adaptLegacyBoard({
			columns: [{ id: "0", items: [{ id: "h" }, { id: "m" }] }],
			blocks: [{ id: "b", parent: [{ column: "0", items: ["h"] }], members: [{ column: "0", items: ["m"] }] }],
		});
		const rows = columns[0]?.rows ?? [];
		expect(rows.find((r) => r.id === "h")?.groupHeader).toBe(true);
		expect(rows.find((r) => r.id === "m")?.group).toBe("b");
	});

	it("maps a legacy twin to a duplicate anchor", () => {
		const { ribbons } = adaptLegacyBoard({
			columns: [{ id: "0", items: [{ id: "1" }] }, { id: "1", items: [{ id: "1" }] }],
			connections: [{ id: "c", ends: [{ column: "0", items: ["1"] }, { column: "1", items: ["1"] }], marks: [{ column: "0", line: "1", from: 0, to: 1, twin: { column: "1", line: "1", from: 0, to: 1 } }] }],
		});
		expect(ribbons[0]?.anchors?.[0]?.duplicate?.column).toBe("1");
	});
});

describe("adaptLegacyTones / adaptLegacyTheme", () => {
	it("maps tone fill/hot/line/paint into semantic colors", () => {
		const colors = adaptLegacyTones({ same: { fill: "red", hot: "brightred", line: "ink", paint: "mark" } });
		expect(colors.same).toEqual({ fill: "red", hot: "brightred", text: "ink", paint: "mark" });
	});

	it("builds a theme carrying the colors", () => {
		const theme = adaptLegacyTheme({ paper: "#000", panel: "#111", edge: "#222", text: "#fff", dim: "#aaa", faint: "#777", mono: "monospace" }, { duplicate: { fill: "red" } });
		expect(theme.colors?.duplicate?.fill).toBe("red");
		expect(theme.paper).toBe("#000");
	});
});
