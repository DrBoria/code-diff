// Browser demo for @md-code/code-diff. Renders several fixtures on the generic
// N-column board so the view can be verified visually: a real git "as was / as
// now" diff, a renamed-copy side-by-side, a three-way merge, and a deep tree.
// Built with esbuild into demo/dist and opened as a file:// page.

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CodeDiff } from "../view.js";
import type { Column, Connection, Theme, Tones } from "../interface/types.js";
import { gitBoard } from "./git-board.js";
import { itemsBefore, itemsAfter } from "./fixtures/git-items.js";

const theme: Theme = {
	paper: "#1e1f22",
	panel: "#2b2d30",
	edge: "#393b40",
	text: "#dfe1e5",
	dim: "#a8adbd",
	faint: "#6f737a",
	mono: "'JetBrains Mono', 'Fira Code', monospace",
	paint: "rgba(255,107,107,0.22)",
	ribbon: "#8a8f98",
	shadow: "0 0 3px rgba(0,0,0,0.9)",
};

// WebStorm-like: green = added/unique, red = removed/changed, blue = conflict.
const tones: Tones = {
	same: { fill: "rgba(120,200,170,0.10)", line: "rgba(120,200,170,0.25)", hot: "rgba(120,200,170,0.30)", paint: "rgba(120,200,170,0.20)" },
	differs: { fill: "rgba(255,107,107,0.12)", line: "rgba(255,107,107,0.30)", hot: "rgba(255,107,107,0.32)", paint: "rgba(255,107,107,0.22)" },
	added: { fill: "rgba(120,200,170,0.16)", line: "rgba(120,200,170,0.4)", hot: "rgba(120,200,170,0.36)", paint: "rgba(120,200,170,0.26)" },
	removed: { fill: "rgba(255,107,107,0.16)", line: "rgba(255,107,107,0.4)", hot: "rgba(255,107,107,0.36)", paint: "rgba(255,107,107,0.26)" },
	conflict: { fill: "rgba(120,160,255,0.16)", line: "rgba(120,160,255,0.4)", hot: "rgba(120,160,255,0.36)", paint: "rgba(120,160,255,0.26)" },
};

const codeCol = (id: string, lines: string[], extra: Partial<Column> = {}): Column => ({
	id,
	kind: "items",
	items: lines.map((text, i) => ({ id: String(i + 1), plate: String(i + 1), text })),
	...extra,
});

// ── Fixture 1: real git diff (as was / as now) ──────────────────────────────
const git = gitBoard(itemsBefore, itemsAfter, 3);

// ── Fixture 2: renamed copy, word-level marks ───────────────────────────────
const renameLeft = ["function clampValue(n, lo, hi) {", "  if (n < lo) return lo;", "  if (n > hi) return hi;", "  return n;", "}"];
const renameRight = ["function boundNumber(value, min, max) {", "  if (value < min) return min;", "  if (value > max) return max;", "  return value;", "}"];
const rename: { columns: Column[]; connections: Connection[] } = {
	columns: [codeCol("left", renameLeft, { fold: false }), codeCol("right", renameRight, { fold: false })],
	connections: [
		{ id: "sig", tone: "differs", label: "signature", ends: [{ column: "left", items: ["1"] }, { column: "right", items: ["1"] }],
			marks: [
				{ column: "left", line: "1", from: 9, to: 19, twin: { column: "right", line: "1", from: 9, to: 20 } },
				{ column: "right", line: "1", from: 9, to: 20, twin: { column: "left", line: "1", from: 9, to: 19 } },
			] },
		{ id: "body", tone: "same", label: "body", ends: [{ column: "left", items: ["2", "3", "4", "5"] }, { column: "right", items: ["2", "3", "4", "5"] }] },
	],
};

// ── Fixture 3: three-way merge ──────────────────────────────────────────────
const merge: { columns: Column[]; connections: Connection[] } = {
	columns: [
		codeCol("base", ["const timeout = 30;", "retry = true;", "log(level);"], { fold: false }),
		codeCol("ours", ["const timeout = 60;", "retry = true;", "log(level);"], { fold: false }),
		codeCol("theirs", ["const timeout = 30;", "retry = false;", "log(level, ctx);"], { fold: false }),
	],
	connections: [
		{ id: "m1", tone: "conflict", label: "timeout", ends: [{ column: "base", items: ["1"] }, { column: "ours", items: ["1"] }, { column: "theirs", items: ["1"] }] },
		{ id: "m2", tone: "differs", label: "retry", ends: [{ column: "base", items: ["2"] }, { column: "ours", items: ["2"] }, { column: "theirs", items: ["2"] }] },
		{ id: "m3", tone: "same", label: "log", ends: [{ column: "base", items: ["3"] }, { column: "ours", items: ["3"] }, { column: "theirs", items: ["3"] }] },
	],
};

// ── Fixture 4: one-to-many ribbon (a band spanning many rows) ───────────────
const many: { columns: Column[]; connections: Connection[] } = {
	columns: [
		codeCol("src", ["// header", "import a from 'a';", "import b from 'b';", "", "export function run() {", "  a();", "  b();", "  return a() + b();", "}"], { fold: false }),
		codeCol("dst", ["import { a, b } from 'lib';", "", "export const run = () => a() + b();"], { fold: false }),
	],
	connections: [
		{ id: "imports", tone: "differs", label: "imports collapsed", ends: [{ column: "src", items: ["2", "3"] }, { column: "dst", items: ["1"] }] },
		{ id: "body", tone: "same", label: "body inlined", ends: [{ column: "src", items: ["5", "6", "7", "8", "9"] }, { column: "dst", items: ["3"] }] },
	],
};

const fixtures = [
	{ key: "git", title: "Git diff — Items.tsx (v0.4 → v0.5)", subtitle: `real history · ${git.counts.change ?? 0} changed · ${git.counts.add ?? 0} added · ${git.counts.remove ?? 0} removed`, columns: git.columns, connections: git.connections, corridors: [40], fold: true },
	{ key: "rename", title: "Renamed copy — word marks", subtitle: "clampValue → boundNumber · only the differing tokens painted", columns: rename.columns, connections: rename.connections, corridors: [120], fold: false },
	{ key: "merge", title: "Three-way merge", subtitle: "base / ours / theirs · conflict tone", columns: merge.columns, connections: merge.connections, corridors: [60, 60], fold: false },
	{ key: "many", title: "One-to-many ribbons", subtitle: "a band of many rows tied to one row", columns: many.columns, connections: many.connections, corridors: [120], fold: false },
];

const App = () => {
	const [active, setActive] = useState("git");
	const [log, setLog] = useState<string[]>([]);
	const f = fixtures.find((x) => x.key === active) ?? fixtures[0];
	const note = (s: string) => setLog((l) => [s, ...l].slice(0, 6));

	return (
		<div style={{ background: theme.paper, color: theme.text, minHeight: "100vh", fontFamily: "system-ui, sans-serif", padding: 16 }}>
			<h1 style={{ fontSize: 18, margin: "0 0 4px" }}>@md-code/code-diff — browser fixtures</h1>
			<p style={{ color: theme.dim, fontSize: 13, margin: "0 0 12px" }}>Generic N-column board · ribbons measured from real DOM boxes · view only</p>
			<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
				{fixtures.map((x) => (
					<button key={x.key} onClick={() => setActive(x.key)}
						style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.edge}`, cursor: "pointer",
							background: x.key === active ? theme.panel : "transparent", color: x.key === active ? theme.text : theme.dim, fontSize: 13 }}>
						{x.title}
					</button>
				))}
			</div>
			<div style={{ color: theme.faint, fontSize: 12, marginBottom: 8 }}>{f.subtitle}</div>
			<div style={{ border: `1px solid ${theme.edge}`, borderRadius: 8, overflow: "hidden" }}>
				<CodeDiff
					theme={theme}
					tones={tones}
					columns={f.columns}
					connections={f.connections}
					corridors={f.corridors}
					options={{ foldUnconnected: f.fold, diffContext: 3, maxHeight: "70vh" }}
					controller={{
						onRowClick: (e) => note(`row ${e.column}#${e.item}`),
						onConnectionClick: (c) => note(`connection ${c.id} (${c.tone ?? "same"})`),
						onPick: (e) => note(e === null ? "pick cleared" : `pick ${e.column}#${e.item}`),
						onReveal: () => note("unfolded equal run"),
					}}
				/>
			</div>
			<div style={{ marginTop: 12, color: theme.dim, fontSize: 12, fontFamily: theme.mono }}>
				{log.length === 0 ? "click a row or ribbon — the controller reports it here" : log.map((l, i) => <div key={i}>{l}</div>)}
			</div>
		</div>
	);
};

createRoot(document.getElementById("root")!).render(<App />);
