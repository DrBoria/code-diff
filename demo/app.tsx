// Browser demo for @md-code/code-diff. Renders several fixtures on the generic
// N-column board so the view can be verified visually: a real git "as was / as
// now" diff, a renamed-copy side-by-side, a three-way merge, and a deep tree.
// Built with esbuild into demo/dist and opened as a file:// page.

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CodeDiff } from "../view.js";
import type { BoardAction, Column, Connection, RowRef, Theme, Tones } from "../interface/types.js";
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
	same: { fill: "rgba(120,200,170,0.10)", line: "rgba(120,200,170,0.25)", lineHot: "rgba(120,200,170,0.4)", hot: "rgba(120,200,170,0.30)", paint: "rgba(120,200,170,0.20)" },
	differs: { fill: "rgba(255,107,107,0.12)", line: "rgba(255,107,107,0.28)", lineHot: "rgba(255,107,107,0.42)", hot: "rgba(255,107,107,0.32)", paint: "rgba(255,107,107,0.22)" },
	added: { fill: "rgba(120,200,170,0.16)", line: "rgba(120,200,170,0.32)", lineHot: "rgba(120,200,170,0.46)", hot: "rgba(120,200,170,0.36)", paint: "rgba(120,200,170,0.26)" },
	removed: { fill: "rgba(255,107,107,0.16)", line: "rgba(255,107,107,0.32)", lineHot: "rgba(255,107,107,0.46)", hot: "rgba(255,107,107,0.36)", paint: "rgba(255,107,107,0.26)" },
	conflict: { fill: "rgba(120,160,255,0.16)", line: "rgba(120,160,255,0.32)", lineHot: "rgba(120,160,255,0.46)", hot: "rgba(120,160,255,0.36)", paint: "rgba(120,160,255,0.26)" },
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
	{ key: "git", title: "Git diff — Items.tsx (v0.4 → v0.5)", subtitle: `real history · ${git.counts.change ?? 0} changed · ${git.counts.add ?? 0} added · ${git.counts.remove ?? 0} removed`, columns: git.columns, connections: git.connections, corridors: [120], fold: true, sync: [{ columns: ["left", "right"], axis: "xy" as const }] },
	{ key: "rename", title: "Renamed copy — word marks", subtitle: "clampValue → boundNumber · only the differing tokens painted", columns: rename.columns, connections: rename.connections, corridors: [120], fold: false, sync: [{ columns: ["left", "right"], axis: "xy" as const }] },
	{ key: "merge", title: "Three-way merge", subtitle: "base / ours / theirs · conflict tone", columns: merge.columns, connections: merge.connections, corridors: [60, 60], fold: false, sync: [{ columns: ["base", "ours", "theirs"], axis: "xy" as const }] },
	{ key: "many", title: "One-to-many ribbons", subtitle: "a band of many rows tied to one row", columns: many.columns, connections: many.connections, corridors: [120], fold: false, sync: [{ columns: ["src", "dst"], axis: "xy" as const }] },
];

const App = () => {
	const [active, setActive] = useState("git");
	const [log, setLog] = useState<string[]>([]);
	// The controller's state: the selected rows (staged for commit) and the reveal
	// chip. The view draws them and reports changes; this component decides what they
	// mean — exactly the external-controller contract the package promises.
	const [selected, setSelected] = useState<RowRef[]>([]);
	const [revealed, setRevealed] = useState(false);
	const f = fixtures.find((x) => x.key === active) ?? fixtures[0];
	const note = (s: string) => setLog((l) => [s, ...l].slice(0, 6));

	// The actions the owner configures. The view draws icon + label and reports the
	// click; this handler performs it. `apply-left/right/both` and `stage` are all the
	// same shape — the package knows nothing about merging.
	const actions: BoardAction[] = [
		{ id: "apply-left", label: "Apply left", scope: "toolbar", icon: <span>←</span>, onAction: (_ref, sel) => note(`apply-left → ${sel.length} row(s)`) },
		{ id: "apply-right", label: "Apply right", scope: "toolbar", icon: <span>→</span>, onAction: (_ref, sel) => note(`apply-right → ${sel.length} row(s)`) },
		{ id: "apply-both", label: "Apply both", scope: "toolbar", icon: <span>⇄</span>, onAction: (_ref, sel) => note(`apply-both → ${sel.length} row(s)`) },
		{ id: "stage", label: "Stage selection", scope: "toolbar", icon: <span>✓</span>, disabled: () => selected.length === 0, onAction: (_ref, sel) => note(`staged ${sel.length} row(s): ${sel.map((r) => `${r.column}#${r.item}`).join(", ")}`) },
		{ id: "stage-row", label: "Stage this row", icon: <span>+</span>, onAction: (ref) => ref !== null && note(`staged row ${ref.column}#${ref.item}`) },
	];

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
				<button onClick={() => setRevealed((r) => !r)}
					style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.edge}`, cursor: "pointer",
						background: revealed ? theme.panel : "transparent", color: theme.text, fontSize: 13 }}>
					{revealed ? "show all" : "only blocks"}
				</button>
			</div>
			<div style={{ color: theme.faint, fontSize: 12, marginBottom: 8 }}>{f.subtitle}</div>
			<div style={{ border: `1px solid ${theme.edge}`, borderRadius: 8, overflow: "hidden" }}>
				<CodeDiff
					key={f.key}
					theme={theme}
					tones={tones}
					columns={f.columns}
					connections={f.connections}
					corridors={f.corridors}
					sync={f.sync}
					options={{ foldUnconnected: f.fold, diffContext: 3, boardHeight: "70vh" }}
					controller={{
						// The owner's chip owns reveal: the board shows exactly this state and
						// reports fold-button toggles back, so the two can never disagree.
						reveal: revealed,
						onReveal: (next) => { setRevealed(next); note(next ? "unfolded equal run" : "folded back to blocks"); },
						// Selection is the controller's: click a checkbox to stage rows 1, 2, 5, 7
						// while 4 and 6 stay out. A row click still filters (no onRowClick override).
						selected,
						onSelect: (next) => { setSelected(next); note(`selection: ${next.length} row(s)`); },
						actions,
						onConnectionClick: (c) => note(`connection ${c.id} (${c.tone ?? "same"})`),
						onPick: (e) => note(e === null ? "pick cleared" : `pick ${e.column}#${e.item}`),
						onRowHover: (e) => { if (e !== null) note(`hover ${e.column}#${e.item}`); },
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
