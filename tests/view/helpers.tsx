import React from "react";
import { CodeDiff } from "../../view.js";
import type { Column, Connection, Theme, Tones, ViewProps } from "../../interface/types.js";

// A minimal theme/tones so the board renders in jsdom without a real palette.
export const theme: Theme = {
	paper: "#111",
	panel: "#181818",
	edge: "#333",
	text: "#eee",
	dim: "#aaa",
	faint: "#777",
	mono: "monospace",
	paint: "rgba(255,107,107,0.2)",
	ribbon: "#eee",
};

export const tones: Tones = {
	same: { fill: "rgba(255,107,107,0.1)", line: "rgba(255,107,107,0.1)", hot: "rgba(255,107,107,0.3)" },
	differs: { fill: "rgba(120,200,170,0.1)", line: "rgba(120,200,170,0.1)", hot: "rgba(120,200,170,0.3)" },
};

export const codeColumn = (id: string, lines: string[], extra: Partial<Column> = {}): Column => ({
	id,
	kind: "items",
	items: lines.map((text, i) => ({ id: String(i + 1), plate: String(i + 1), text })),
	...extra,
});

export const renderBoard = (props: Partial<ViewProps> & { columns: Column[] }) => (
	<CodeDiff theme={theme} tones={tones} {...props} />
);

export type { Connection };