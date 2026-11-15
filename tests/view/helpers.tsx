import React from "react";
import { CodeDiff } from "../../view.js";
import type { BoardProps, Column, Ribbon } from "../../index.js";
import { defaultTheme } from "../../styles/default-theme.js";

// A minimal theme so the board renders in jsdom without a real palette. The
// semantic keys (duplicate/unique/…) carry the colours the board paints with.
export const theme = defaultTheme;

export const codeColumn = (id: string, lines: string[], extra: Partial<Column> = {}): Column => ({
	id,
	rows: lines.map((text, i) => ({ id: String(i + 1), plate: String(i + 1), text })),
	...extra,
});

export const renderBoard = (props: Partial<BoardProps> & { columns: Column[] }) => (
	<CodeDiff theme={theme} {...props} />
);

export type { Ribbon };
