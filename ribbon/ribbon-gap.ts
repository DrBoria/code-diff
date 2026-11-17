/**
 * ── ONE-SIDED GAP TARGET ───────────────────────────────────────────────────
 *
 * A member that exists on one side only continues as an inter-line micro-line
 * hugging the opposite BLOCK: the member sits below its side's placed members
 * → the gap ABOVE the opposite block's last placed row; above → the gap BELOW
 * its first. Pure facts about row ids — no DOM, no colour.
 */
import type { MarkRow, MemberLink, Located } from "./ribbon-model.js";

const columnIndex = (columns: readonly string[], id: string): number => Math.max(0, columns.indexOf(id));
import type { RibbonEnd } from "./ribbon-types.js";

const collectIds = (list: readonly MarkRow[], column: number, out: string[]): void => {
	for (const row of list) {
		if (row.type === "fold") {
			if (row.rows) collectIds(row.rows, column, out);
			continue;
		}
		const cell = row.cells[column];
		if (cell && cell.no != null) out.push(String(cell.no));
	}
};

/** The row ids of one column's cells (fold-nested rows included), in order. */
export const columnRowIds = (rows: readonly MarkRow[], column: number): string[] => {
	const out: string[] = [];
	collectIds(rows, column, out);
	if (out.length === 0) return [];

	return out;
};

const maxId = (ids: readonly string[], fallback: string): string => ids.reduce((best, id) => (Number(id) > Number(best) ? id : best), ids[0] ?? fallback);
const minId = (ids: readonly string[], fallback: string): string => ids.reduce((best, id) => (Number(id) < Number(best) ? id : best), ids[0] ?? fallback);

export interface GapTargetArgs {
	readonly ownLine: string;
	readonly placedOwn: readonly string[];
	readonly placedOther: readonly string[];
	readonly otherColumn: string;
}

/** The gap end hugging the opposite block's OUTER edge: the member sits below
 *  its side's placed members → the gap BELOW the opposite block's LAST row
 *  (between it and the hidden row after the block); above → the gap ABOVE its
 *  FIRST row (between the hidden row before the block and it). */
export const gapEndFor = ({ ownLine, placedOwn, placedOther, otherColumn }: GapTargetArgs): RibbonEnd | null => {
	if (placedOther.length === 0) return null;
	const lastOwn = maxId(placedOwn, ownLine);
	const firstOwn = minId(placedOwn, ownLine);
	if (Number(ownLine) >= Number(lastOwn)) return { column: otherColumn, rows: [], gap: { after: maxId(placedOther, "") } };
	if (Number(ownLine) <= Number(firstOwn)) return { column: otherColumn, rows: [], gap: { before: minId(placedOther, "") } };

	return null;
};

/** The line a resolved lane places in one column (empty when none). */
export const placedIn = (lane: { link: MemberLink; left: Located | null; right: Located | null }, column: string): string[] => {
	if (lane.link.leftColumn === column && lane.left !== null) return [lane.left.line];
	if (lane.link.rightColumn === column && lane.right !== null) return [lane.right.line];

	return [];
};

/** The inter-line gap end for a one-sided link (null when two-sided). */
interface OneSidedArgs {
	readonly rows: readonly MarkRow[];
	readonly columns: readonly string[];
	readonly link: MemberLink;
	readonly left: Located | null;
	readonly right: Located | null;
	readonly placedOf: (column: string) => string[];
}

export const oneSidedGap = ({ rows, columns, link, left, right, placedOf }: OneSidedArgs): RibbonEnd | null => {
	if (left !== null && right !== null) return null;
	const ownColumn = left !== null ? link.leftColumn : link.rightColumn;
	const ownLine = left !== null ? left?.line : right?.line;
	if (ownLine == null) return null;
	const otherColumn = left !== null ? link.rightColumn : link.leftColumn;
	const otherIds = columnRowIds(rows, columnIndex(columns, otherColumn));
	const placedOther = placedOf(otherColumn).filter((id) => otherIds.includes(id));

	return gapEndFor({ ownLine, placedOwn: placedOf(ownColumn), placedOther, otherColumn });
};

