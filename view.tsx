/**
 * The React entry point. `CodeDiff` IS the generic N-column board — one name,
 * one component: columns of rows, ribbons between them, one actions array, one
 * events map, one theme.
 */
export { Board, Board as CodeDiff } from "./board/Board.js";
export { Actions } from "./components/Actions.js";
export { Chip, Toolbar, Legend, Typography } from "./components/atoms.js";
export { Board as default } from "./board/Board.js";
