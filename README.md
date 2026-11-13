# @md-code/code-diff

A generic, configurable **code-diff view** for React. N columns, any item tied to
any item of any other column, ribbons drawn between the real DOM boxes — so a
ribbon narrows or widens by itself when one of its ends spans many rows.

It is **view only**. It does not decide what is compared, perform a merge, or
mutate your data. You hand it columns, items and connections (by id); it measures,
aligns, paints and reports interactions back to your controller. The same component
renders a side-by-side code comparison, a git tree comparison, or a three-way merge.

Nothing here knows what the columns mean. There are no groups, no verdicts, no
domain words. A column has an `id` and items; an item's ADDRESS IS its `id`; a
connection names ids. Colour is yours too — the package ships no palette.

## Install

```sh
npm install @md-code/code-diff react react-dom styled-components
```

`react`, `react-dom` and `styled-components` are peer dependencies.

## The contract

```ts
interface ConnectionEnd {
	readonly column: string;            // which column
	readonly items: readonly ItemId[];  // WHICH of its items — one or many
}

interface Connection {
	readonly id: string;                // your connectionId
	readonly tone?: string;             // a key of `tones`
	readonly label?: string;            // caption drawn on the ribbon
	readonly ends: readonly ConnectionEnd[]; // one end per column
	readonly marks?: readonly LaneMark[];    // exact character ranges (+ twins)
}
```

A connection is the whole ribbon: ten ids in the first column tied to three in the
third is ONE connection with two ends. Nothing counts rows and nothing turns line
numbers into pixels — the board measures the ids it finds in the DOM. Band merging
is by **visual adjacency**, so ids may be line numbers, tree paths or git hunk ids.

## Use

```tsx
import { CodeDiff } from "@md-code/code-diff/view";

<CodeDiff
	theme={theme}
	tones={tones}
	columns={[
		{ id: "left", kind: "items", items: leftItems },
		{ id: "right", kind: "items", items: rightItems },
	]}
	connections={[
		{ id: "c1", tone: "same", label: "body", ends: [
			{ column: "left", items: ["66", "67", "68"] },
			{ column: "right", items: ["74", "75", "76"] },
		] },
	]}
	corridors={[220]}
/>;
```

### Columns and items

```ts
interface Column {
	id: string;
	kind: "items" | "graph" | (string & {}); // your own kind via `renderers`
	items?: Item[];
	width?: number;      // fixed px
	ratio?: number;      // share of free space (fr); wins over width
	mirrored?: boolean;  // hint: draw the number plate on the outer edge
	cap?: boolean;       // height capped to the board; scrolls inside it
	fold?: boolean;      // false keeps every row (no folding) for this column
}

interface Item {
	id: string;          // the address a connection names
	plate?: string;      // the line-number / label plate
	text?: string;       // plain text; the package tokenizes + marks it
	segments?: Segment[];// or take full control of the pieces
	marks?: Mark[];      // character ranges to paint as shared evidence
	notes?: Note[];      // numbers pinned above a character offset
	tone?: string;       // this row's tone when it differs from its lane
	line?: string;       // the row this one STANDS FOR (a tree row → a code line)
	data?: unknown;      // opaque payload for your own renderer
}
```

### Colours: `theme` and `tones`

The package has no colours. `theme` is the chrome (paper, panel, edges, text, mono
font, optional `paint`, `paintInk`, `ribbon`, `shadow`). `tones` maps a tone key to
`{ fill, line?, hot? }` — `fill` is the resting wash, `hot` the lane under the pointer.
Any number of tones, any names: `same`/`differs`, `added`/`removed`/`conflict`, …

### Options (`BoardOptions`)

Every display knob is configurable; omit `options` for the defaults.

| option | default | meaning |
| --- | --- | --- |
| `rowHeight` | 18 | height of one row (px); spacers and CSS stay in step |
| `bandGap` | 1 | hairline gap above/below a band |
| `diffContext` | 3 | equal lines kept at each end of a folded run |
| `maxWordTokens` | 400 | above this a changed line is not word-diffed |
| `fullMount` | 400 | lists up to this many rows mount whole (no windowing) |
| `overscan` | 1 | viewports kept mounted above/below the window |
| `hubLanes` | 3 | an id in this many lanes is a hub a hover won't walk through |
| `maxHeight` | "74vh" | max height of an uncapped pane |
| `foldUnconnected` | true | hide rows in no connection (false shows all, e.g. git) |
| `foldLabel` | "N lines hidden…" | label of a folded run, given the count |

### Controller (view only reports, you decide)

```ts
interface BoardController {
	onRowClick?: (ref: { column: string; item: string }) => void;
	onConnectionClick?: (connection: Connection) => void;
	onPick?: (ref: RowRef | null) => void;
	onReveal?: () => void;
	picked?: RowRef | null; // controlled focus
}
```

Pass `controller` to receive interactions. code-diff never applies a merge — your
controller does, then re-renders with new columns/connections. Omit `controller`
for the built-in comparison behaviour (click focuses a chain, fold reveals).

### Custom renderers

`renderers={{ tree: MyTree }}` replaces how a whole column `kind` is drawn; `render`
replaces how one item is drawn. Both must keep the geometry contract: the linked
element carries `data-anchor`, inside the element carrying `data-column`.

## Helpers (model API, no React)

`import { diffLines, buildConnections, resolveLanes } from "@md-code/code-diff"`

- `diffLines(first, second, options?)` — align two spans into rows (line + word LCS,
  folding). Optional: git produces its own hunks, so you may hand rows directly.
- `buildConnections(rowLinks, caption?)` — group consecutive same-key rows into
  connections, collapsing each column's ids.
- `resolveLanes(rows, columns, memberLinks)` — turn semantic "this name matches that
  name" links into drawn lanes with character marks and twins.

## Examples

### Side-by-side code (git changes)

Two `items` columns, `foldUnconnected: false` to show every line, connections per
hunk. `diffLines` builds the rows; `buildConnections` groups them.

### Git tree comparison

Two columns of a custom `tree` kind (file paths as items), connections tying a path
on the left to the same path on the right. Ids are paths — band merging is by
position, not numeric ids.

### Three-way merge

Three columns `left` / `merge` / `right`, one connection per hunk spanning all three.
A controller's `onConnectionClick` applies left / right / both; the view only reports
the click and re-renders what the controller decides.

## Layout

- `interface/` — the contract, types only.
- `columns/` — the item renderer and its pieces.
- `connections/` — grouping rows into connections, edges inside a column.
- `geometry/` — measuring boxes and turning ids into bands + ribbons.
- `marks/` — resolving semantic links into character ranges and twins.
- `rows/` — the optional line/word diff helper.
- `surface/` — the grid, corridors, shape layer, virtual scroll, controller wiring.
- `config.ts` — the display defaults and `resolveOptions`.

## License

Apache-2.0