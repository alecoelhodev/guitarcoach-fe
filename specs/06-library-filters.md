# 06 — Task library: category & difficulty filters

**Status:** not started · **Size:** S · **Depends on:** nothing · **Wireframes:** canvas 03, 03b, 2b

`src/features/library/library-list.tsx` calls `useTasks()` with no arguments. The hook already
accepts `TaskFilters` and `GET /tasks` already supports `category` and `difficulty` — only the UI
is missing. Good first task; no dependency on spec 01.

## Scope

- Two `Chip` rows above the list:
  - **Category**: Technique · Theory · Repertoire
  - **Difficulty**: Easy · Medium · Hard
- Values must match the backend enums exactly (lowercase: `technique|theory|repertoire`,
  `easy|medium|hard`). Display them capitalised; send them lowercase.
- Filters are **additive across the two rows** and single-select within a row (the backend takes one
  `category` and one `difficulty`, not arrays). Tapping an active chip clears it.
- A dashed **Clear** chip appears **only when at least one filter is active** (canvas 03).
- A result count line: "8 tasks · Technique · Medium". `total` comes from the response `meta` — use
  it, don't count the loaded page.
- Keep the existing **Load more** pagination. Canvas 03 is explicit: pages load on demand, not
  infinite scroll.

Changing a filter must reset pagination to page 1. `queryKeys.tasks(query)` already includes the
filter object, so a filter change is a distinct cache entry and TanStack handles this — verify
rather than assume.

## States (canvas 03b)

- Loading: skeleton cards.
- **No results**: "No tasks match these filters" / "Try removing a difficulty." + a Clear filters
  button. Distinct from the never-loaded empty state.
- Error: `ErrorPanel` + Retry, and **filters stay as the user set them** (canvas 03b says so
  explicitly — don't reset them on failure).

## Out of scope

- **The search input.** `FindTasksQueryDto` is `page`/`limit`/`category`/`difficulty` only — there
  is no search parameter. Do not add a client-side search over the loaded page; it would appear to
  search the catalog while missing everything not yet paged in. See `00-api-contract-reference.md`.

## Acceptance

- [ ] Each chip drives the request; combining category + difficulty sends both.
- [ ] Clear removes all filters and is hidden when none are active.
- [ ] The count reflects `meta.total`, not the loaded page length.
- [ ] The no-results state is distinguishable from the empty-catalog state.
- [ ] Filters survive a failed load and a retry.
- [ ] `tsc`, `expo lint`, `biome ci`, `npm test` clean.
