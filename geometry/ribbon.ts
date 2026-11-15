import type { Box, Connection, ConnectionEnd, LaneBand, LaneRibbon, LaneShape, Placed } from "../interface/types.js";

/**
 * ── GEOMETRY ────────────────────────────────────────────────────────────────
 *
 * Scene-graph free, domain free, column-count free. A connection names column
 * ids and item ids; this module measures those ids and returns SVG paths:
 *
 *   • BAND   — the fill behind a block, over the WHOLE width of its column.
 *   • RIBBON — the corridor strip: block edge → curve → flat plateau → curve →
 *              other block edge. The flat middle is where the caption sits, so it
 *              does not drift when the panes scroll.
 *
 * Ends are BLOCKS of any height: 1 row meeting 50 rows is a wide wedge, 8 meeting
 * 8 is a straight band. Nothing here knows what an item means.
 */

const round = (value: number): number => Math.round(value * 10) / 10;


export type AnchorLookup = (column: string, id: string) => Box | null;

/** The only things geometry needs about a column: its id and its measured box. */
export interface RibbonColumn {
	readonly id: string;
	readonly mirrored?: boolean;
	readonly box?: Box | null;
}

/** A measured, merged vertical span inside one column. */
interface Span {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

/** A measured end: the blocks its ids gather into, and their bounding box. */
interface MeasuredEnd {
	readonly column: string;
	/** The measured ids, with their boxes — what the BANDS are cut from. */
	readonly entries: ReadonlyArray<{ id: string; box: Box }>;
	readonly blocks: readonly Box[];
	readonly box: Box;
}

/**
 * The tone of one row, when the owner gave it one. `null` = the lane's own tone,
 * which is the default and the only case the contract promises.
 */
export type ToneLookup = (column: string, id: string) => string | null;

/**
 * THE TONE A LANE IS DRAWN IN, resolved from the rows it actually joins. A lane the
 * owner labelled `same` may name rows the owner also marked `differs` (a property
 * that exists on both sides but whose text breaks the correspondence). Drawing the
 * ribbon red over green bands claimed "red or green?" — the road and the rows it
 * joins must be ONE colour. So the lane takes the tone of its rows: if every row it
 * names carries the same explicit tone, that is the lane's tone; otherwise the
 * owner's label stands. The bands are cut by the same rule, so road and bands agree.
 */
const resolvedTone = (connection: Connection, toneOf?: ToneLookup): string => {
	const own = connection.tone ?? "default";
	if (toneOf === undefined) return own;
	let seen: string | null = null;
	for (const end of connection.ends) {
		for (const id of end.items) {
			const tone = toneOf(end.column, String(id));
			if (tone === null) continue;
			if (seen === null) seen = tone;
			else if (seen !== tone) return own;
		}
	}

	return seen ?? own;
};

const boxesOfEnd = (end: ConnectionEnd, lookup: AnchorLookup): Array<{ id: string; box: Box }> =>
	end.items
		.map((id) => ({ id: String(id), box: lookup(end.column, String(id)) }))
		.filter((entry): entry is { id: string; box: Box } => entry.box !== null)
		.sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);

/**
 * GATHER ids into blocks by VISUAL ADJACENCY: boxes that touch vertically are one
 * block (a statement, a run of property names), a gap starts the next one. This
 * works for ANY id — numeric line numbers, tree-node paths, git hunk ids — because
 * it looks at the measured position, never at the id's value. Two boxes are
 * adjacent when the next starts within a hairline of where the previous ended.
 */
const ADJACENT = 2;

const touches = (last: Box, next: Box): boolean => next.top <= last.bottom + ADJACENT;

const blocksOf = (entries: ReadonlyArray<{ id: string; box: Box }>): Box[] => {
	const blocks: Array<{ top: number; bottom: number; left: number; right: number }> = [];

	for (const entry of entries) {
		const last = blocks[blocks.length - 1];
		if (last !== undefined && touches(last, entry.box)) {
			last.top = Math.min(last.top, entry.box.top);
			last.bottom = Math.max(last.bottom, entry.box.bottom);
			last.left = Math.min(last.left, entry.box.left);
			last.right = Math.max(last.right, entry.box.right);
		} else {
			blocks.push({ ...entry.box });
		}
	}

	return blocks;
};

/** The bounding box of an end: for the ribbon's width only, never for matching. */
const endBox = (boxes: readonly Box[]): Box => ({
	top: Math.min(...boxes.map((box) => box.top)),
	bottom: Math.max(...boxes.map((box) => box.bottom)),
	left: Math.min(...boxes.map((box) => box.left)),
	right: Math.max(...boxes.map((box) => box.right)),
});

/**
 * The same gathering, cut by TONE: ids that follow each other AND share a tone are
 * one band. A lane whose rows are all the same tone yields exactly the blocks it
 * did before — one row that breaks the correspondence is the only thing that
 * splits a band, and it splits it in two.
 */
const blocksByTone = (entries: ReadonlyArray<{ id: string; box: Box }>, column: string, toneOf?: ToneLookup): Array<Box & { tone: string | null }> => {
	const blocks: Array<{ top: number; bottom: number; left: number; right: number; tone: string | null }> = [];

	for (const entry of entries) {
		const tone = toneOf?.(column, entry.id) ?? null;
		const last = blocks[blocks.length - 1];

		if (last !== undefined && last.tone === tone && touches(last, entry.box)) {
			last.top = Math.min(last.top, entry.box.top);
			last.bottom = Math.max(last.bottom, entry.box.bottom);
			last.left = Math.min(last.left, entry.box.left);
			last.right = Math.max(last.right, entry.box.right);
		} else {
			blocks.push({ ...entry.box, tone });
		}
	}

	return blocks;
};

/** A filled band: a plain rectangle behind ONE id, over the whole column. */
const bandPath = (span: Span, left: number, right: number): string =>
	[
		`M ${round(left)} ${round(span.top)}`,
		`L ${round(right)} ${round(span.top)}`,
		`L ${round(right)} ${round(span.bottom)}`,
		`L ${round(left)} ${round(span.bottom)}`,
		"Z",
	].join(" ");

/**
 * A straight ribbon between two blocks (used when a connection touches more than
 * two columns). Top/bottom edges are cubic beziers, so unequal heights fan out.
 */
const ribbonPath = (a: Box, ax: number, b: Box, bx: number): string => {
	const mid = round((ax + bx) / 2);

	return [
		`M ${round(ax)} ${round(a.top)}`,
		`C ${mid} ${round(a.top)} ${mid} ${round(b.top)} ${round(bx)} ${round(b.top)}`,
		`L ${round(bx)} ${round(b.bottom)}`,
		`C ${mid} ${round(b.bottom)} ${mid} ${round(a.bottom)} ${round(ax)} ${round(a.bottom)}`,
		"Z",
	].join(" ");
};

/** The vertical run two boxes share: how tall a band between them can be. */
const overlapOf = (a: Box, b: Box): number => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

/** How tall one code row is: a lane is measured in rows, not in pixels. */
const ROW_HEIGHT = 18;

/** Where the flat middle of a two-column ribbon sits, and how tall it is. */
const waistOf = (a: Box, b: Box, ax: number, bx: number, labelWidth = 0, dip = 0) => {
	const midX = round((ax + bx) / 2);
	const top = Math.max(a.top, b.top);
	const overlap = overlapOf(a, b);
	// With a caption the flat band must be tall enough for the 10px text (≥14px).
	const minHalf = labelWidth > 0 ? 7 : 2;
	// A lane is a BAND, not the whole block it joins: two rows is the ceiling. A band as
	// tall as the block left no room for the lanes that join the same rows, so they had
	// to be printed on top of each other and pushed the board below its code.
	const maxHalf = Math.round(ROW_HEIGHT);
	const half = round(Math.min(Math.max(minHalf, overlap / 2), maxHalf));
	// `dip` moves the FLAT middle down, while both ends stay on their rows: a lane
	// whose corridor is already taken bends away instead of leaving its bands.
	const nodeY = round(top + half + dip);
	const span = Math.abs(bx - ax);
	// The plateau is a HALF-length; its straight run is twice this. It must be long
	// enough for the caption, or the text spills off the line it names.
	const plateau = Math.max(16, Math.ceil(span * 0.14), Math.ceil((labelWidth + 16) / 2));

	return { midX, nodeY, half, plateau, top };
};

/**
 * Two full-width bands joined through the corridor: each edge climbs from the
 * full block height to a FLAT plateau at the top rows (where the caption sits),
 * then back to the other block. The plateau is a straight segment, so scrolling
 * never drags the label; the curves only live near the columns.
 *
 * The climb turns over 45% of the run on each side instead of meeting in the
 * exact middle: the same shape, with the bend barely softened.
 */
const waistPath = (a: Box, ax: number, b: Box, bx: number, labelWidth = 0, dip = 0): string => {
	const { midX, nodeY, half, plateau } = waistOf(a, b, ax, bx, labelWidth, dip);
	const nTop = round(nodeY - half);
	const nBot = round(nodeY + half);
	const pL = round(midX - plateau);
	const pR = round(midX + plateau);
	const runL = (pL - ax) * 0.45;
	const runR = (bx - pR) * 0.45;

	return [
		`M ${round(ax)} ${round(a.top)}`,
		`C ${round(ax + runL)} ${round(a.top)} ${round(pL - runL)} ${nTop} ${pL} ${nTop}`,
		`L ${pR} ${nTop}`,
		`C ${round(pR + runR)} ${nTop} ${round(bx - runR)} ${round(b.top)} ${round(bx)} ${round(b.top)}`,
		`L ${round(bx)} ${round(b.bottom)}`,
		`C ${round(bx - runR)} ${round(b.bottom)} ${round(pR + runR)} ${nBot} ${pR} ${nBot}`,
		`L ${pL} ${nBot}`,
		`C ${round(pL - runL)} ${nBot} ${round(ax + runL)} ${round(a.bottom)} ${round(ax)} ${round(a.bottom)}`,
		"Z",
	].join(" ");
};

/**
 * One connection → one band per contiguous run per column (full column width),
 * plus one ribbon per neighbouring pair of ends. For exactly two ends the ribbon
 * is the plateau shape; otherwise straight per pair.
 */
export const connectionShape = (
	connection: Connection,
	columns: readonly RibbonColumn[],
	lookup: AnchorLookup,
	dip = 0,
	toneOf?: ToneLookup,
): LaneShape | null => {
	const orderOf = (id: string): number => columns.findIndex((column) => column.id === id);
	const boxOf = (id: string): Box | null => columns.find((column) => column.id === id)?.box ?? null;

	const ends = connection.ends
		.map((end) => ({ end, order: orderOf(end.column) }))
		.filter((entry) => entry.order >= 0)
		.sort((a, b) => a.order - b.order)
		.map(({ end }): MeasuredEnd => {
			const entries = boxesOfEnd(end, lookup);
			const blocks = blocksOf(entries);

			return { column: end.column, entries, blocks, box: endBox(blocks) };
		});

	// ONLY THE ENDS THE BOARD CAN SEE. Columns are virtual: a lane may name a row that a
	// fold has just scrolled out of the mounted window. Requiring EVERY end to be measured
	// dropped the whole lane then — opening one fold and leaving no ribbon anywhere. The
	// claim is still only drawn between ends that are both on screen: two visible ends, or
	// nothing.
	const visible = ends.filter((entry) => entry.blocks.length > 0);
	if (visible.length < 2) return null;

	const bands: LaneBand[] = [];

	for (const end of visible) {
		const columnBox = boxOf(end.column);
		// The BAND is cut by the tone of the rows: a lane that spans a row which does not
		// correspond paints that row in its own tone instead of swallowing it.
		for (const block of blocksByTone(end.entries, end.column, toneOf)) {
			const left = columnBox !== null ? columnBox.left : block.left;
			const right = columnBox !== null ? columnBox.right : block.right;
			bands.push({ column: end.column, path: bandPath({ top: block.top, bottom: block.bottom, left: block.left, right: block.right }, left, right), top: block.top, bottom: block.bottom, ...(block.tone === null ? {} : { tone: block.tone }) });
		}
	}

	const ribbons: LaneRibbon[] = [];
	let caption: Placed | null = null;
	let ribbon: Box | null = null;
	let solid = false;

	if (visible.length === 2) {
		const left = visible[0];
		const right = visible[1];

		if (left !== undefined && right !== undefined) {
			const ax = boxOf(left.column)?.right ?? left.box.right;
			const bx = boxOf(right.column)?.left ?? right.box.left;
			// Caption is 10px mono: ~6px per character.
			const labelWidth = (connection.label?.length ?? 0) * 6;
			const { midX, nodeY, half } = waistOf(left.box, right.box, ax, bx, labelWidth, dip);

			ribbons.push({ from: left.column, to: right.column, path: waistPath(left.box, ax, right.box, bx, labelWidth, dip) });
			// A plateau that already spans the shared rows is a SOLID band: nothing to
			// separate, and nothing to dip — dipping it only threw the block below the rows.
			solid = half * 2 >= overlapOf(left.box, right.box) - 2;
			// The caption NAMES the lane, so it is a HEADER of the band: on the band's TOP
			// edge, above the first row the lane joins — never inside the shape, where it
			// would read as part of the code it is drawn over.
			caption = { x: round(midX), y: round(nodeY - half + 11) };
			// Only the CORRIDOR part matters for overlap: two lanes over the same rows still
			// have their flat middles to separate.
			ribbon = { top: round(nodeY - half), bottom: round(nodeY + half), left: round(ax), right: round(bx) };
		}
	} else {
		for (let index = 0; index < visible.length - 1; index += 1) {
			const left = visible[index];
			const right = visible[index + 1];
			if (left === undefined || right === undefined) continue;

			const fromX = boxOf(left.column)?.right ?? left.box.right;
			const toX = boxOf(right.column)?.left ?? right.box.left;
			ribbons.push({ from: left.column, to: right.column, path: ribbonPath(left.box, fromX, right.box, toX) });
		}

		const first = visible[0];
		const second = visible[1];
		if (first !== undefined && second !== undefined) {
			const fromX = boxOf(first.column)?.right ?? first.box.right;
			const toX = boxOf(second.column)?.left ?? second.box.left;
			const top = round(Math.min(first.box.top, second.box.top));
			const bottom = round(Math.max(first.box.bottom, second.box.bottom));
			caption = { x: round((fromX + toX) / 2), y: top + 10 };
			ribbon = { top, bottom, left: round(fromX), right: round(toX) };
		}
	}

	return {
		id: connection.id,
		tone: resolvedTone(connection, toneOf),
		label: connection.label ?? null,
		bands,
		ribbons,
		ribbon,
		caption,
		solid,
	};
};

/**
 * Every lane of a board, laid out so that no two ribbons share the same space in a
 * corridor. The first lane keeps its natural waist; one that would sit on top of a
 * placed ribbon is DIPPED — its flat middle moves down inside the corridor while
 * both ends stay on their rows, so it never detaches from its bands.
 */
/**
 * ── ONE LANE, ONE SLOT ──────────────────────────────────────────────────────
 *
 * A corridor is a vertical strip between two columns, and every lane that crosses it
 * needs its own height inside it. Two lanes in the same slot overlap, and their
 * captions land on the same line — a picture that claims two different lanes are one
 * row. Both are physically impossible here, because a slot is ALLOCATED:
 *
 *   1. every lane is measured where its rows put it;
 *   2. inside one corridor lanes claim free slots in row order, and a lane that would
 *      sit on an occupied slot is pushed until it does not;
 *   3. the push is a `dip` — only the flat middle of the ribbon moves, both ends stay
 *      on their bands, so a lane never leaves the rows it joins.
 *
 * The caption is then drawn from the lane's own band, so one lane has exactly one
 * caption, and no two captions share a line.
 */
interface Slot {
	top: number;
	bottom: number;
}

const collides = (a: Slot, b: Slot): boolean => a.top < b.bottom && b.top < a.bottom;

/** How far a lane has to move down to stop touching the slots already taken. */
const freeShift = (natural: Slot, taken: readonly Slot[]): number => {
	let shift = 0;
	// Every slot that the moved lane still touches pushes it past its bottom edge. The
	// loop ends because each step strictly increases the shift.
	for (;;) {
		const moved = { top: natural.top + shift, bottom: natural.bottom + shift };
		const blocking = taken.filter((slot) => collides(moved, slot));
		if (blocking.length === 0) return shift;
		shift = Math.max(...blocking.map((slot) => slot.bottom + 2 - natural.top));
	}
};

const corridorOf = (shape: LaneShape): string | null =>
	shape.ribbon === null ? null : `${Math.round(shape.ribbon.left)}:${Math.round(shape.ribbon.right)}`;

/**
 * ── THE SAME BOARD, WITH THE INDEX KEPT ─────────────────────────────────────
 *
 * A repaint that writes into existing SVG nodes has to know WHICH connection a
 * shape belongs to, not only where it goes: the slot allocator may drop a lane
 * (an end is folded away), and dropping it must not shift every shape after it
 * onto the wrong node. The index is the connection's own position, so a shape
 * keeps its identity for the whole life of the board.
 */
export interface IndexedShape {
	readonly index: number;
	readonly connection: Connection;
	readonly shape: LaneShape;
}

export const shapesOf = (
	connections: readonly Connection[],
	columns: readonly RibbonColumn[],
	lookup: AnchorLookup,
	toneOf?: ToneLookup,
): IndexedShape[] => {
	const measured = connections
		.map((connection, index) => ({ connection, index, shape: connectionShape(connection, columns, lookup, 0, toneOf) }))
		.filter((entry): entry is { connection: Connection; index: number; shape: LaneShape } => entry.shape !== null);

	const out: LaneShape[] = measured.map((entry) => entry.shape);
	// Slots are per CORRIDOR: two lanes in different corridors cannot overlap, so they
	// must not push each other — a lane would move for no reason.
	const taken = new Map<string, Slot[]>();

	// THE BOARD'S OWN HEIGHT. A dip may move a flat middle DOWN, but never below the
	// columns it joins: pushing lanes into the empty space under the code drew ribbons
	// that hung off the bottom of the board ("ribbons dipping to a strange place").
	// The ceiling is the lowest bottom edge of the columns this corridor touches.
	const ceilingOf = (shape: LaneShape): number => {
		let ceiling = Infinity;
		for (const ribbon of shape.ribbons) {
			for (const id of [ribbon.from, ribbon.to]) {
				const box = columns.find((column) => column.id === id)?.box;
				if (box != null) ceiling = Math.min(ceiling, box.bottom);
			}
		}

		return ceiling;
	};

	// Row order, so a lane keeps its natural height whenever it can: the first lane over
	// a row stays where it is and the later one moves.
	const order = measured
		.map((entry, at) => ({ at, top: entry.shape.ribbon?.top ?? 0 }))
		.sort((a, b) => a.top - b.top);

	for (const { at } of order) {
		const entry = measured[at];
		if (entry === undefined) continue;
		const corridor = corridorOf(entry.shape);
		const ribbon = entry.shape.ribbon;
		if (corridor === null || ribbon === null) continue;
		const slots = taken.get(corridor) ?? [];
		let shift = freeShift({ top: ribbon.top, bottom: ribbon.bottom }, slots);
		// CONTAIN the dip: if the free slot would fall below the board, pull it back up
		// to the last height that still fits. Two lanes may then share a plateau, which
		// reads as one road — far better than a ribbon detached from its rows.
		const ceiling = ceilingOf(entry.shape);
		if (Number.isFinite(ceiling)) {
			const height = ribbon.bottom - ribbon.top;
			const maxShift = Math.max(0, ceiling - height - ribbon.top);
			if (shift > maxShift) shift = maxShift;
		}
		if (shift > 0) {
			// Re-measure with the dip: the same lane, the same bands, a free flat middle.
			const moved = connectionShape(entry.connection, columns, lookup, shift, toneOf);
			if (moved !== null) out[entry.index] = moved;
		}
		const placed = out[entry.index]?.ribbon ?? ribbon;
		slots.push({ top: placed.top, bottom: placed.bottom });
		taken.set(corridor, slots);
	}

	return measured.map((entry) => ({ index: entry.index, connection: entry.connection, shape: out[entry.index] ?? entry.shape }));
};

/** The shapes only: the same board, in connection order. */
export const connectionShapes = (
	connections: readonly Connection[],
	columns: readonly RibbonColumn[],
	lookup: AnchorLookup,
	toneOf?: ToneLookup,
): LaneShape[] => shapesOf(connections, columns, lookup, toneOf).map((entry) => entry.shape);
