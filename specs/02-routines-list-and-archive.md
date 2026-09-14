# 02 — Routines list: Active/Archived + create entry points

**Status:** not started · **Size:** M · **Depends on:** 01 · **Wireframes:** canvas 05, 05b, 2c

Today `src/features/routines/routines-list.tsx` renders one flat paginated list with a single
"Ask AI Coach to draft one" button. Two backend capabilities have no UI at all: the `status`
filter, and routine creation.

**This matters more than it looks.** A scheduled backend job archives every routine still `active`
from before the current week (Monday 00:00 UTC — see `00-api-contract-reference.md`). Without an
Archived view, routines silently disappear and the app reads as broken.

## Scope

### Active / Archived segment

- Add a `Segmented` control (`src/components/ui/segmented.tsx`) above the list: **Active** |
  **Archived**. Default Active.
- Drive `useRoutines({ status })`. The hook and `GET /routines?status=` already support this — no
  transport change.
- Segment state is local component state. Do not persist it and do not put it in the URL; the
  route is a tab, and expo-router typed routes don't carry a query param here.
- Archived cards, per canvas 05b: dimmed, an "Archived" badge, **no Start Practice button**, and a
  **Restore to active** action that calls `useUpdateRoutine(id)` with `{ status: 'active' }`.

### Create Routine

- Add a **Create Routine** secondary button below the list (canvas 05 places it under the AI Coach
  ghost button; keep that order).
- It opens the routine builder in create mode — see `03-routine-builder.md`. Decide the mechanism
  there, not here; this spec only needs the entry point to exist and navigate.

### Empty states (canvas 05b)

- Active, empty: "No routines yet" / "Build one from the library or ask the coach." Keep both the
  AI Coach and Create Routine actions visible.
- Archived, empty: a quieter "Nothing archived yet." Do not offer create actions from the archived
  tab — they'd land the user back on Active with no explanation.
- Loading: skeleton cards. Error: `ErrorPanel` with Retry. Both already have primitives.

## Explicitly out of scope

- **No search field.** `GET /routines` has no search parameter (`FindRoutinesQueryDto` is
  `page`/`limit`/`status` only). The wireframe's picker-sheet search is unbuildable — see
  `00-api-contract-reference.md`.
- Don't re-derive `taskCount` or `totalTargetDurationMinutes`; they're on the list response.

## Acceptance

- [ ] Switching the segment refetches with the right `status` and does not reuse the other tab's
      cache (the `queryKeys.routines(query)` key already includes filters — verify it does).
- [ ] Restore moves a routine from Archived to Active and both lists reflect it without a manual
      refresh.
- [ ] Archived cards expose no Start Practice affordance.
- [ ] Tests: a `routines-list` suite covering both segments, the restore mutation, and both empty
      states. Mock the `.queries` module and build results with `src/test/query-hooks.ts` — screens
      don't mount a real `QueryClient` in this repo.
- [ ] `tsc`, `expo lint`, `biome ci`, `npm test` clean.
