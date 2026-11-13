import type { ReactElement } from "react";
import type { Renderers, ViewProps } from "./interface/types.js";
import { Surface } from "./surface/Surface.js";
import { Graph, Items } from "./columns/Items.js";

/** The React entry point: the built-in renderers, overridable by the owner. */
const builtin: Renderers = { items: Items, graph: Graph };

export const CodeDiff = <Data,>(props: ViewProps<Data>): ReactElement => (
	<Surface {...props} renderers={{ ...builtin, ...(props.renderers ?? {}) }} />
);

export { Surface, Items, Graph };
export { buildConnections, type RowLink, type BandCaption } from "./connections/group.js";
export default CodeDiff;
