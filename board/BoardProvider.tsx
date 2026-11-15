import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from "react";
import { ThemeProvider } from "styled-components";
import type { BoardProps, ResolvedConfig } from "./board-types.js";
import type { Theme } from "../styles/theme-types.js";
import { resolveTheme } from "../styles/default-theme.js";
import { resolveConfig } from "../config.js";
import { makeEmitter, type Emitter } from "./events.js";
import { useBoardState, type BoardStateApi } from "./hooks/use-board-state.js";

/**
 * The composition context: resolved config + theme + state + emitter. Every
 * feature reads what it needs from here; nothing reaches into a sibling's state.
 */
export interface BoardContextValue {
	readonly config: ResolvedConfig;
	readonly theme: Theme;
	readonly state: BoardStateApi;
	readonly emit: Emitter["emit"];
	readonly props: BoardProps;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export const useBoard = (): BoardContextValue => {
	const value = useContext(BoardContext);
	if (value === null) throw new Error("code-diff: useBoard must be used inside <Board>");
	return value;
};

export const BoardProvider = ({ props, children }: { props: BoardProps; children: ReactNode }): ReactElement => {
	const config = useMemo(() => resolveConfig(props.config), [props.config]);
	const theme = useMemo(() => resolveTheme(props.theme), [props.theme]);
	const emitter = useMemo(() => makeEmitter(props.events), [props.events]);
	const state = useBoardState(props.state, props.reveal ?? false, emitter.emit);
	const value = useMemo<BoardContextValue>(() => ({ config, theme, state, emit: emitter.emit, props }), [config, theme, state, emitter, props]);

	return (
		<BoardContext.Provider value={value}>
			<ThemeProvider theme={theme}>{children}</ThemeProvider>
		</BoardContext.Provider>
	);
};
