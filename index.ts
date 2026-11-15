/**
 * code-diff · public API.
 *
 * The model helpers (no React, no DOM, no colour) plus every feature's types.
 * The React entry is `./view` (the Board).
 */

// Model helpers used by the uniqueness domains.
export { diffLines, diffWords, ROW, DIFF, type Span, type LineRow, type LineCell, type Word, type DiffOptions, type RowType } from "./rows/diff.js";
export { resolveLanes, locate, rangeOf, cellText, pairTwins, buildConnections, type MarkRow, type MarkCell, type MemberLink, type MemberLinkEnd, type Located, type KeyedMark, type RowLink, type BandCaption } from "./ribbon/ribbon-model.js";

// Feature types.
export type { Row, RowId, RowRef, RowTextSpan, TextRangeHighlight, Counter, ExplanationNote, Token, Box } from "./rows/row-types.js";
export type { Column, SyncGroup, Fit, Layout, ConnectedMap } from "./columns/column-types.js";
export type { Ribbon, RibbonEnd, RibbonTextAnchor, RibbonConnector, MeasuredRibbon } from "./ribbon/ribbon-types.js";
export type { Theme, SemanticColor, SurfaceTheme } from "./styles/theme-types.js";
export { defaultTheme, resolveTheme } from "./styles/default-theme.js";
export type { BoardAction, ActionEntity, ActionPlacement, ActionVariant, ActionParams } from "./components/actions-types.js";
export type { BoardProps, BoardState, BoardConfig, ResolvedConfig, RowRender, ColumnRender } from "./board/board-types.js";
export type { Events, EventMap, EventName, EventHandler, BoardEvent, RowEventMap, ColumnEventMap, RibbonEventMap, BoardEventMap } from "./board/events.js";
export { resolveConfig, DEFAULT_CONFIG } from "./config.js";
export { adaptLegacyBoard, adaptLegacyTones, adaptLegacyTheme, type LegacyBoard, LegacyColumn, LegacyItem, LegacyConnection, LegacyBlock, LegacyTone, AdaptedBoard } from "./board/legacy.js";
