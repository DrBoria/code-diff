# Architecture of `@md-code/code-diff`

The package is a **view**. It draws the work somebody else already did and adds
no knowledge of its own.

## The one rule: representation, not derivation

`code-diff` never decides WHAT is shared, WHERE a name is written, or WHICH
characters belong together. Those answers belong to the decision maker that
produced them, and the package receives them as **positions — numbers**.

> "They are highlighted by COLUMN numbers, not by searching for a string inside
> a substring." — the operator of this package

So the only thing a renderer may do with text is **cut it at the offsets it was
given**. `indexOf`, `lastIndexOf`, `search`, `match`, `matchAll`, `split`,
`replace`, regex scanning, "find the word in the line" — none of these belong
here. A word painted at the wrong place because two identifiers share letters is
the failure this rule exists to prevent.

## What comes in

Every piece of evidence is already located by the producer:

```ts
interface Mark {
	readonly from: number; // character offset in the item's `text`
	readonly to: number; // exclusive
	readonly ink?: string; // a key of `tones`
}

interface Segment {
	readonly text: string;
	readonly paint?: string; // painted characters
	readonly ink?: string;
}

interface Token {
	readonly text: string;
	readonly ink?: string; // syntax colour, from the injected highlighter
}
```

* `Item.text` + `Item.marks` — the caller says which spans are evidence, by
  offset. The package does not look at the text to find them.
* `Item.segments` — the caller may instead hand over the already-cut pieces, in
  which case nothing is cut here at all.
* `Item.tokens` — syntax colouring, produced by the highlighter the caller
  passes as a prop. The package consumes its token boundaries; it does not
  tokenise, and it does not know the language.
* `Connection` — ends name `column` ids and `ItemId`s. Which items are tied is
  the caller's answer; the package only measures their DOM boxes.

Converting a producer's 1-based source column into an item offset happens ONCE,
at the edge where the caller builds the items. Inside the package everything is
offsets and ids.

## Layers

| folder | role | contains |
| --- | --- | --- |
| `interface/` | **contract** | types only — the whole public vocabulary |
| `geometry/` | **model** | measured boxes + ids → ribbon paths. No React, no DOM |
| `rows/` | **model** | lines of one text mapped onto another → the rows a comparison is drawn from |
| `connections/` | **model** | row groups → plain `Connection[]`, and the edges inside a column |
| `columns/` | model + **view** | `segments.ts` (cut at given offsets) and the `Items` renderer |
| `surface/` | **view** | the N-column grid, corridors, the SVG shape layer, scroll sync |
| `index.ts`, `view.tsx` | **entry** | the public surface |

A column has an `id` and items. There is no left, no right, no group, no
verdict, no domain word — a board with 2 columns and a board with 540 columns are
the same code.

## Enforced

`architecture.yaml` carries `no-string-search`, which fails the build when a
renderer starts locating text instead of painting the offsets it was given.
