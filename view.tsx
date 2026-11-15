import type { ReactElement } from "react";
import { Board } from "./board/Board.js";
import type { BoardProps } from "./board/board-types.js";

/**
 * The React entry point. `CodeDiff` is the generic N-column board: columns of
 * rows, ribbons between them, one actions array, one events map, one theme.
 */
export const CodeDiff = (props: BoardProps): ReactElement => <Board {...props} />;

export { Board };
export { Actions } from "./components/Actions.js";
export { Chip, Toolbar, Legend, Typography } from "./components/atoms.js";
export default CodeDiff;
