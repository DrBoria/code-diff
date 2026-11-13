# Architecture of `@md-code/code-diff`

The package is a **generic, configurable view**. It draws a comparison somebody
else already decided and adds no domain knowledge of its own. The same component
renders side-by-side code, a git tree comparison, or a three-way merge; all actions
(apply left / right / both) come from an external controller.

## The one rule: representation, not derivation (in the view)

A **renderer** never decides WHAT is shared, WHERE a name is written, or WHICH
characters belong together. Those answers arrive as **positions — numbers** — and
a renderer only cuts text at the offsets it was given.

> "They are highlighted by COLUMN numbers, not by searching for a string inside
> a substring." — the operator of this package

So a renderer may not `indexOf` / `match` / `search` / `split` / `replace` to find
evidence. A word painted at the wrong place because two identifiers share letters
is the failure this rule exists to prevent. The `no-string-search` invariant binds
the view (`surface/` and the `columns/` renderers).

### The edge: `marks/` derives positions for the producer

`marks/` is the ONE place allowed to locate text, because it is a **model-side
helper that runs at the edge**: it turns a producer's semantic links ("this name
matches that name") into `Mark { from, to }` positions and twins. It is where
positions come FROM, not a renderer. A producer that already knows its offsets
(git hunks, a decision maker) never needs it.

## What comes in

Every piece of evidence is already located by the producer:

```ts
interface Mark { from: number; to: number; ink?: string; strong?: boolean }
interface Segment { text: string; paint?: boolean; ink?: string }
interface Token { text: string; ink?: string }
```

* `Item.text` + `Item.marks` — the caller says which spans are evidence, by offset.
* `Item.segments` — the caller may hand over already-cut pieces; nothing is cut here.
* `tokenize` prop — syntax colouring from the caller's highlighter; the package
  consumes token boundaries, it does not tokenise and does not know the language.
* `Connection` — ends name `column` ids and `ItemId`s. Which items are tied is the
  caller's answer; the package only measures their DOM boxes.

## Configurable, not closed

Every display knob lives in `config.ts` (`BoardOptions` → `resolveOptions`) and is
overridable through `ViewProps.options`: row height, band gap, diff context, word
limit, virtual-scroll thresholds, max height, folding and the fold label. Colours
are entirely the caller's (`theme` + `tones`); the package ships no palette and no
baked-in dark assumption (the glyph backdrop is `theme.shadow`).

## Controller: the view reports, the owner decides

`ViewProps.controller` carries `onRowClick`, `onConnectionClick`, `onPick`,
`onReveal` and a controlled `picked`. The view performs no merge and mutates no
dataset — it reports interactions and re-renders what the controller decides.
Omitting it keeps the built-in comparison behaviour (click focuses a chain).

## Layers

| folder | role | contains |
| --- | --- | --- |
| `interface/` | **contract** | types only — the whole public vocabulary |
| `geometry/` | **model** | measured boxes + ids → band/ribbon paths. No React, no DOM |
| `rows/` | **model** | optional line/word diff: two spans → rows |
| `connections/` | **model** | row groups → `Connection[]`, edges inside a column |
| `marks/` | **model (edge)** | semantic links → character positions + twins |
| `columns/` | model + **view** | `segments.ts` (cut at offsets) and the `Items`/`Graph` renderers |
| `surface/` | **view** | the N-column grid, corridors, SVG layer, virtual scroll, controller |
| `config.ts`, `constants.ts` | **model** | display defaults; the diff vocabulary |
| `index.ts`, `view.tsx` | **entry** | the public surface |

A column has an `id` and items. There is no left, no right, no group, no verdict,
no domain word — a board with 2 columns and a board with 540 columns are the same
code. Band merging is by **visual adjacency**, so ids may be line numbers, tree
paths or git hunk ids alike.

## Enforced

`architecture.yaml` carries `no-string-search` (view only), `no-oversized-files`,
`no-large-folders`, `no-require`, `no-classes` and the role boundaries above.