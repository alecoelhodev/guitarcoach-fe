# 05 — Task detail: Add to Routine

**Status:** not started · **Size:** M · **Depends on:** 01 · **Wireframes:** canvas 04, 04b, 2b

`src/features/library/task-detail.tsx` renders badges, description and the reference link, then
stops. Canvas 04's primary action — **Add to Routine** — does not exist, so the Library is
currently a dead end: you can browse tasks but never use one.

This is the other half of `04-routine-task-management.md`'s add flow, entered from the task side.

## Scope

- Add a primary **Add to Routine** button plus the footnote "Tasks are shared and read-only."
- It opens a picker. On mobile: a bottom sheet (`@gorhom/bottom-sheet` is already a dependency). On
  web ≥768px, canvas 2b renders the same content as an **inline panel** in the detail pane, not a
  sheet. Share one component across both arrangements.

### Picker contents

- Routine list from `useRoutines({ status: 'active' })`, paginated with a **Load more** button.
  Canvas 04's annotation is explicit that it does not show all routines at once.
- **Archived routines are excluded** — the annotation says a task added to an archived routine has
  nowhere useful to go. Pass `status: 'active'`.
- Single-select rows with a radio tick, each showing the routine's `taskCount`.
- A **Target duration** stepper, optional, minimum 1 (see `04-routine-task-management.md`).
- Primary **Add task** → `useAddRoutineTask(routineId)` with `{ taskId, targetDurationMinutes? }`.
  Omit `position`.
- Secondary **New routine instead** → navigates to the create route from `03-routine-builder.md`.

### States (canvas 04b)

| State            | Behaviour                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Saving           | Button label becomes "Adding…", per canvas 01c's "no spinner-only state" rule                              |
| Success          | Sheet closes, detail screen stays, toast: "Added to `<routine>` · View routine" (4s, above the bottom nav) |
| **409 conflict** | "This task is already in `<routine>`. Change its duration there instead." Keep the sheet open              |
| Failure          | Panel with Try again / Dismiss                                                                             |

The 409 is a designed state, not an error — the backend's `@@id([routineId, taskId])` makes a task
unique per routine. Do not surface it as a generic failure.

## Out of scope

- **The "Find a routine" search input in canvas 04.** `GET /routines` has no search parameter.
  Ship the paginated list without a search field rather than filtering one loaded page, which
  would look like search but silently miss routines on later pages. Noted in
  `00-api-contract-reference.md`.

## Acceptance

- [ ] Add to Routine is reachable from a task detail on both mobile and web.
- [ ] Only active routines are listed; Load more pages through them.
- [ ] Adding surfaces the toast and the routine's `taskCount` is correct on next view.
- [ ] Adding a task already in the chosen routine shows the conflict copy and leaves the sheet open.
- [ ] Tests: the sheet renders through its provider (see `withGluestack` / `OverlayProvider` note in
      AGENTS.md — a bare render produces empty output).
- [ ] `tsc`, `expo lint`, `biome ci`, `npm test` clean.
