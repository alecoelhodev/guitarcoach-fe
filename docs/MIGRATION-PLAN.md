# Guitar Coach FE — UI migration record

Replaced the Organic-styled UI (cream `#f5ead8` / terracotta `#c67139`, Caprasimo +
Figtree) with the dark/blue design in
[`wireframes/Guitar Coach Wireframes.dc.html`](../wireframes/Guitar%20Coach%20Wireframes.dc.html),
which is now the authority for every colour, radius and type size.

**Completed 2026-09-04.** Phases 0–5 below all landed. This file started as a plan and is
kept as the record; several of its original premises were wrong, and those corrections are
folded in so the next reader doesn't inherit them.

## Outcome

- Engine: **NativeWind 4.2.6 + Tailwind 3.4.19**, with `tailwind.config.ts` deriving
  colors, spacing and radii **from `src/theme/tokens.ts`** — one source of truth for both
  `className` and `StyleSheet`.
- **Gluestack v5** (`@gluestack-ui/core@5.0.15`, `@gluestack-ui/utils@5.0.6`) for the five
  behaviour-heavy primitives; the other fifteen stayed hand-written because v5 has no
  equivalent. No `overrides`, `resolutions`, patches or shims.
- All 20 primitives, the nav shell and all 16 implemented screens match the canvas.
- **Zero changes** to `src/api/`, `src/stores/`, any `*.queries.ts`, or the active-session
  store — verified by `git diff --stat` on each.

## Corrections to this document's original assumptions

- **20 primitives, not 17.** The original count omitted `banner`, `password-input` and
  `query-state`; `query-state` is the loading/error/empty ladder five screens depend on.
- **`app-tabs.tsx` / `app-tabs.web.tsx` never existed.** The nav files are
  `src/components/nav/app-nav.tsx`, `app-shell.tsx` / `app-shell.web.tsx`, `rail.web.tsx`
  and `practice-fab.tsx`.
- **The toast host already existed** (`src/stores/toast-store.ts` +
  `src/components/toast-host.tsx`). It was never a gap to close.
- **Coach, profile and session screens were already built.** The original "do not touch,
  unbuilt" list was wrong about all three.
- **The raised Practice button was already resolved** as a floating FAB. The canvas's
  `.bnc` is a 58px circle overlapping the bar — i.e. exactly that — so it was kept and
  resized rather than replaced with a custom JS tab bar.
- **The web rail already existed;** there was no top pill bar to replace. What it lacked
  was the leading Practice action, which was added.
- **`npx gluestack-ui init` is unusable here** — see AGENTS.md § Styling toolchain. Its
  output was reverted; the toolchain is hand-written.
- The original token table also **omitted shadows entirely**, specified Inter at three
  weights where the canvas uses five (400/500/600/700/800), and gave three radii where the
  canvas uses five plus `pill`.

## Canvas defects deliberately not copied

Three contrast failures in the source, each implemented differently and flagged in code:

| Canvas                                                 | Measured           | Shipped instead                       |
| ------------------------------------------------------ | ------------------ | ------------------------------------- |
| `.tst` toast: `accent2-800` ground, `accent2-100` text | ~1.1:1 — invisible | `accent2Ramp[700]` text (~9:1)        |
| Loading button: `accent-300` ground, `accent-800` text | ~2.2:1             | `text` (`#f2f3f5`)                    |
| Segmented active: `neutral-100` on `accent`            | ~4.5:1             | **Kept** — better than white's ~3.1:1 |

The canvas also sets the _active_ segment to font-weight 400 and the inactive to 600,
making the selected item lighter than its neighbours. Treated as an authoring artifact;
both render at 600.

## A class of bug this surfaced

The Organic ramps ran light-to-dark (`100` lightest); the canvas ramps run dark-to-light.
Any primitive that had picked a ramp step by _lightness_ inverted when the values changed:

- `toast` painted `neutral[900]` — a near-white ground with near-black text.
- `segmented` painted the selected segment darker than its track, reading as a recess.
- `checklist-row` ticked **blue**; the canvas ticks **green** (`accent2`).
- Every error state — panels, banners, invalid inputs, validation text — was tinted from
  the _accent_ ramp, because Organic had no danger token. They would all have rendered
  blue. `danger`/`dangerRamp` now exist and carry them.

## Deliberately out of scope

The canvas depicts 26 screen states, and much of the delta is unbuilt product rather than
restyling. These were skipped because they need API methods or store fields that do not
exist — no stubs were added and no API methods were invented:

library search + filter chips · "Add to Routine" · the routine builder (rename, notes
editing, status, Add Tasks, Archive, Delete) · Active/Archived routine segments · the
Practice choice sheet · blank sessions · the current-task Complete/Previous/Next model
(canvas 07) · session notes editing · recording upload, delete and the web drop zone ·
Profile's inert "Coming later" rows · the web two-pane list/detail layouts.

**Since built.** Home's "Today's practice" and "Active routines" (canvas 02), the new-user
Home (02c) and the web Home layout (2a) landed once `RoutineResponseDto` gained `taskCount`
and `totalTargetDurationMinutes` — the missing API fields that had blocked them. The same
change added the sub-768px web bottom bar, closing the gap between `rail.web.tsx`'s
"shown at 768px+" comment and a rail that actually rendered at every width. See
`docs/ARCHITECTURE.md` § Web nav chrome and § Home.

## Known gaps, unchanged by this work

- **Canvas 08 draws the bottom nav on History,** but the route sits outside `(tabs)`, so no
  tab bar renders there. Fixing it means moving a route, not restyling.
- **`session-detail` issues one `useTask` per session task** — an N+1 against `/tasks/:id`.
  Pre-existing; fixing it is a data-layer change.
- **The unused `ui/actionsheet` scaffolding has been deleted** (438 lines of
  `gluestack-ui add` output that nothing in `src/` imported), along with
  `src/hooks/use-color-scheme{,.web}.ts` — also unimported, and the source of the repo's only
  `expo lint` error.
- Routine cards show no task count or duration: `RoutineResponseDto` carries neither, and
  fetching them per row would be a query per card.
- ~~**`date-grouping.ts` groups by UTC but filters by local time.**~~ **Resolved
  2026-09-17** (QA-07). The product call this was waiting on was made in favour of the local
  calendar day: it is the basis `filterThisWeek` already used and the day the session detail
  screen already printed, so History no longer disagrees with the screen it links to.
  `groupSessionsByDay` now derives the key from `Intl.DateTimeFormat` numeric parts, with an
  injectable `timeZone` — the only way to assert this deterministically under the `TZ=UTC`
  pin in `jest.config.js`. The test that pinned the old behaviour was replaced rather than
  deleted.
- **`formatMinutes` renders `"NaNh NaNm"`** where its sibling `formatClock` guards and returns
  `"0:00"`. Per-task minutes are optional throughout the API, so a `NaN` reaching it is
  plausible. Also pinned by test rather than fixed.
- **`Toast`, `Banner` and `ErrorPanel` set `accessibilityRole="alert"` on a plain `View`
  without `accessible`.** React Native only exposes a view as an accessibility element when
  `accessible` is set, so none of the three is announced as an alert and RNTL's
  `getByRole('alert')` cannot find them either — the suites query them off the rendered tree
  instead. Three components share the defect, so it is a pattern rather than a slip. A
  one-line fix each, but it changes what assistive tech announces, so it is a deliberate
  change rather than a drive-by.
- **`src/components/nav/app-nav.tsx` is the one file left uncovered** (1 statement). It is a
  pure shell over `expo-router/unstable-native-tabs`, which has no Jest mock.
