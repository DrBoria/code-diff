/**
 * Model API: no React, no DOM, no colours, no constants. Everything the view
 * needs arrives through arguments, and everything it produces is plain data.
 */
export { column, item, anchorOf } from "./columns/column.js";
export { edgesOf, endsOf, staysInside, type EdgeEnds } from "./connections/edges.js";
export { buildConnections, type RowLink, type BandCaption } from "./connections/group.js";
export { measureAnchors, anchorLookup, boxOf, columnBoxOf } from "./geometry/measure.js";
export { connectionShape, type AnchorLookup, type RibbonColumn } from "./geometry/ribbon.js";
export { diffLines, diffWords, type Span, type LineRow, type LineCell, type Word, type DiffOptions } from "./rows/lines.js";
export { resolveLanes } from "./marks/resolve.js";
export { locate, rangeOf, cellText, type Located } from "./marks/locate.js";
export { pairTwins, type KeyedMark } from "./marks/twins.js";
export type { MarkRow, MarkCell, MemberLink, ResolvedLane } from "./marks/types.js";
export type * from "./interface/types.js";
