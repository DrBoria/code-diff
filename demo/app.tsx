/**
 * Browser demo for @md-code/code-diff. Every interaction is REAL: the merge tab
 * keeps per-hunk decisions in useState and the result column re-renders on apply;
 * stage selects rows; undo restores. Actions are one array; events one map.
 */
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CodeDiff } from "../view.js";
import type { BoardAction, Column, Ribbon, RowRef, Events } from "../index.js";
import { defaultTheme } from "../styles/default-theme.js";
import { gitBoard } from "./git-board.js";
import { itemsBefore, itemsAfter } from "./fixtures/git-items.js";
import { mergeBoard, initialDecisions, type Decisions, type Decision } from "./merge-state.js";

const theme = defaultTheme;

const codeCol = (id: string, lines: string[], extra: Partial<Column> = {}): Column => ({
	id,
	rows: lines.map((text, i) => ({ id: String(i + 1), plate: String(i + 1), text })),
	...extra,
});

const git = gitBoard(itemsBefore, itemsAfter);

const rename: { columns: Column[]; ribbons: Ribbon[] } = {
	columns: [codeCol("left", ["function clampValue(n, lo, hi) {", "  if (n < lo) return lo;", "  if (n > hi) return hi;", "  return n;", "}"], { fold: false }), codeCol("right", ["function boundNumber(value, min, max) {", "  if (value < min) return min;", "  if (value > max) return max;", "  return value;", "}"], { fold: false })],
	ribbons: [
		{ id: "sig", tone: "changed", label: "signature", ends: [{ column: "left", rows: ["1"] }, { column: "right", rows: ["1"] }], anchors: [{ column: "left", line: "1", from: 9, to: 19, duplicate: { column: "right", line: "1", from: 9, to: 20 } }, { column: "right", line: "1", from: 9, to: 20, duplicate: { column: "left", line: "1", from: 9, to: 19 } }] },
		{ id: "body", tone: "duplicate", label: "body", ends: [{ column: "left", rows: ["2", "3", "4", "5"] }, { column: "right", rows: ["2", "3", "4", "5"] }] },
	],
};

const many: { columns: Column[]; ribbons: Ribbon[] } = {
	columns: [
		codeCol("src", ["// header", "import a from 'a';", "import b from 'b';", "", "export function run() {", "  a();", "  b();", "  return a() + b();", "}"], { fold: false }),
		codeCol("dst", ["import { a, b } from 'lib';", "", "export const run = () => a() + b();"], { fold: false }),
	],
	ribbons: [
		{ id: "imports", tone: "changed", label: "imports collapsed", ends: [{ column: "src", rows: ["2", "3"] }, { column: "dst", rows: ["1"] }] },
		{ id: "body", tone: "duplicate", label: "body inlined", ends: [{ column: "src", rows: ["5", "6", "7", "8", "9"] }, { column: "dst", rows: ["3"] }] },
	],
};

const App = () => {
	const [active, setActive] = useState("merge");
	const [log, setLog] = useState<string[]>([]);
	const [selected, setSelected] = useState<RowRef[]>([]);
	const [revealed, setRevealed] = useState(false);
	const [decisions, setDecisions] = useState<Decisions>(initialDecisions);
	const [history, setHistory] = useState<Decisions[]>([]);
	const note = (s: string) => setLog((l) => [s, ...l].slice(0, 6));

	const merge = useMemo(() => mergeBoard(decisions), [decisions]);

	const apply = (hunkId: string, decision: Decision) => {
		setHistory((h) => [...h, decisions]);
		setDecisions((d) => ({ ...d, [hunkId]: decision }));
		note(`apply ${decision} → ${hunkId}`);
	};
	const undo = () => {
		setHistory((h) => {
			const prev = h[h.length - 1];
			if (prev !== undefined) setDecisions(prev);
			return h.slice(0, -1);
		});
		note("undo");
	};

	// ONE actions array. Merge icons live in the connector (WebStorm); row actions
	// above the row (VSCode); stage in the toolbar.
	const actions: BoardAction[] = [
		{ id: "apply-left", label: "Apply left", icon: <span>←</span>, entity: "ribbon", placement: "connector", onClick: (p) => p.ribbon && apply(p.ribbon.id, "left") },
		{ id: "apply-right", label: "Apply right", icon: <span>→</span>, entity: "ribbon", placement: "connector", onClick: (p) => p.ribbon && apply(p.ribbon.id, "right") },
		{ id: "apply-both", label: "Apply both", icon: <span>⇄</span>, entity: "ribbon", placement: "connector", onClick: (p) => p.ribbon && apply(p.ribbon.id, "both") },
		{ id: "stage", label: "Stage selection", icon: <span>✓</span>, entity: "row", placement: "toolbar", disabled: (p) => p.selected.length === 0, onClick: (p) => note(`staged ${p.selected.length}: ${p.selected.map((r) => `${r.column}#${r.row}`).join(", ")}`) },
		{ id: "undo", label: "Undo", icon: <span>↩</span>, entity: "row", placement: "toolbar", disabled: () => history.length === 0, onClick: undo },
		{ id: "stage-row", label: "stage", entity: "row", placement: "above", variant: "text", onClick: (p) => p.row && setSelected((s) => [...s, p.row as RowRef]) },
	];

	const events: Events = {
		"row:click": (p) => note(`click ${p.row.column}#${p.row.row}`),
		"ribbon:click": (p) => note(`ribbon ${p.ribbon.id}`),
		"row:selectionChange": (p) => setSelected([...p.selected]),
		"board:revealChange": (p) => setRevealed(p.revealed),
	};

	const fixtures: Record<string, { columns: Column[]; ribbons: Ribbon[]; corridors: number[]; fold: boolean; title: string }> = {
		merge: { ...merge, corridors: [70, 70], fold: false, title: "Three-way merge — apply left/right/both in the connector" },
		git: { columns: git.columns, ribbons: [...git.ribbons], corridors: [120], fold: true, title: "Git diff — Items.tsx (v0.4 → v0.5)" },
		rename: { ...rename, corridors: [120], fold: false, title: "Renamed copy — word anchors" },
		many: { ...many, corridors: [120], fold: false, title: "One-to-many ribbons" },
	};
	const f = fixtures[active] ?? fixtures.merge;

	return (
		<div style={{ background: theme.paper, color: theme.text, minHeight: "100vh", fontFamily: "system-ui, sans-serif", padding: 16 }}>
			<h1 style={{ fontSize: 18, margin: "0 0 4px" }}>@md-code/code-diff — live fixtures</h1>
			<p style={{ color: theme.dim, fontSize: 13, margin: "0 0 12px" }}>Generic N-column board · one actions array · one events map · real state</p>
			<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
				{Object.keys(fixtures).map((key) => (
					<button key={key} onClick={() => setActive(key)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.edge}`, cursor: "pointer", background: key === active ? theme.panel : "transparent", color: key === active ? theme.text : theme.dim, fontSize: 13 }}>
						{key}
					</button>
				))}
				<button onClick={() => setRevealed((r) => !r)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.edge}`, cursor: "pointer", background: revealed ? theme.panel : "transparent", color: theme.text, fontSize: 13 }}>
					{revealed ? "show all" : "only blocks"}
				</button>
			</div>
			<div style={{ color: theme.faint, fontSize: 12, marginBottom: 8 }}>{f.title}</div>
			<div style={{ border: `1px solid ${theme.edge}`, borderRadius: 8, overflow: "hidden" }}>
				<CodeDiff
					key={active}
					theme={theme}
					columns={f.columns}
					ribbons={f.ribbons}
					corridors={f.corridors}
					sync={[{ columns: f.columns.map((c) => c.id), axis: "xy" }]}
					config={{ foldUnconnected: f.fold, diffContext: 3, boardHeight: "70vh" }}
					actions={active === "merge" ? actions : actions.filter((a) => a.placement === "toolbar" || a.placement === "above")}
					events={events}
					state={{ revealed, selected }}
				/>
			</div>
			<div style={{ marginTop: 12, color: theme.dim, fontSize: 12, fontFamily: theme.mono }}>
				{log.length === 0 ? "interact — events report here" : log.map((l, i) => <div key={i}>{l}</div>)}
			</div>
		</div>
	);
};

createRoot(document.getElementById("root")!).render(<App />);
