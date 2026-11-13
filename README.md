# @md-code/code-diff

A view of N columns where any item may be tied to any item of another column, and
the ties are drawn between the real DOM boxes — so a ribbon narrows or widens by
itself when one of its ends spans many rows.

Nothing here knows what the columns mean. There are no groups, no verdicts, no
domain words. A column has an `id` and items; an item's ADDRESS IS its `id`; a
connection names ids.

## The contract

```ts
interface ConnectionEnd {
	readonly column: string; // which column
	readonly items: readonly ItemId[]; // WHICH of its items — one or many
}

interface Connection {
	readonly id: string; // your connectionId
	readonly tone?: string; // a key of `tones`
	readonly label?: string;
	readonly ends: readonly ConnectionEnd[]; // one end per column
}
```

A connection is the whole ribbon: ten ids in the first column tied to three in
the third is ONE connection with two ends. Nothing counts rows and nothing turns
line numbers into pixels — the board measures the ids it finds in the DOM.

## Use

```tsx
import { CodeDiff } from "@md-code/code-diff/view";

<CodeDiff
	theme={theme}
	tones={tones}
	columns={[
		{ id: "left", kind: "items", scroll: "xy", sync: { vertical: "rows", horizontal: "rows" }, items: leftItems },
		{ id: "right", kind: "items", scroll: "xy", sync: { vertical: "rows", horizontal: "rows" }, items: rightItems },
	]}
	connections={[
		{ id: "c1", tone: "same", label: "body", ends: [{ column: "left", items: [66, 67, 68] }, { column: "right", items: [74, 75, 76] }] },
	]}
	corridors={[220]}
	onAction={(item) => console.log(item.id)}
/>;
```

- `columns[].sync` — `{ vertical, horizontal }` group ids: columns naming the
  same group scroll together, and the two axes are independent.
- `Item.anchor` — defaults to the item id; set it only if two items must share
  one address.
- `Item.segments` — `{ text, paint?, ink? }`: what a row says, which characters
  are painted as shared evidence, and in which colour.

## Layout

- `interface/` — the contract, types only.
- `columns/` — the item renderer and its pieces.
- `links/` — edges inside one column.
- `geometry/` — measuring boxes and turning ids into ribbons.
- `board/` — the grid, the corridors, the layer of shapes, the scroll groups.
