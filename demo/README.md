# code-diff — browser demo

A standalone page that renders the generic N-column board (`@md-code/code-diff`)
against several fixtures so the view can be checked visually, in a real browser,
without any host application.

## Run

```bash
pnpm install
pnpm build:demo        # esbuild → demo/app.js (gitignored)
```

Then open `demo/index.html` directly (`file://`) — no server needed.

## Fixtures

| Button | What it shows |
| --- | --- |
| **Git diff — Items.tsx (v0.4 → v0.5)** | A real "as was / as now" split diff of `columns/Items.tsx` across commit `3d7faa7` (v0.5.0). Changed lines are ONE row pair (not delete+add); only the differing token is painted red. Equal runs fold away with a `⋯ N lines hidden — click to show` button that expands them. WebStorm-like. |
| **Renamed copy — word marks** | `clampValue → boundNumber`: standing `LaneMark` ranges paint on hover, twin ranges on both sides. |
| **Three-way merge** | base / ours / theirs columns with a conflict tone and many-to-many ribbons. |
| **One-to-many ribbons** | A band of many source rows tied to one destination row. |

The git fixture's before/after (`fixtures/Items.before.tsx`, `fixtures/Items.after.tsx`)
are byte-for-byte `git show HEAD~1:columns/Items.tsx` / `git show HEAD:columns/Items.tsx`
— authentic history, not hand-written. `fixtures/git-items.ts` embeds them as strings.

## Interactions verified in-browser

- Hover a changed row → its ribbon lights across both columns.
- Click a row → `onRowClick` + `onPick` report to the log strip.
- Click a ribbon → `onConnectionClick` reports the whole connection and focuses it.
- Click a fold button → the equal run expands (8 → 338 rows on the git fixture).

## Adapter

`git-board.ts` turns a two-sided line diff (`diffLines`) into board columns + one
ribbon per changed hunk. Folding is the **view's** job: every row is emitted, equal
rows are named by no connection, and the board folds those unconnected runs itself
(`foldUnconnected`, `diffContext`). Covered by `tests/model/git-board.test.ts`.
