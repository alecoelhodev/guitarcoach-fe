# 04 — Routine builder: task add / remove / duration

**Status:** not started · **Size:** M · **Depends on:** 01, 03 · **Wireframes:** canvas 06, 06b, 2c

The second half of the builder. Reorder already works; add, remove and per-task duration do not.

## Scope

Inside the routine builder's task list (canvas 06: tap a row to expand its controls in place; the
web arrangement in canvas 2c keeps them always-visible on a single line):

### Per-task duration

- A `Stepper` (`src/components/ui/stepper.tsx`, already used by the active session) bound to
  `targetDurationMinutes` via `useUpdateRoutineTask(routineId)`.
- **Minimum is 1** (`@IsInt() @Min(1)`). The stepper must not reach 0 — send `undefined` to clear
  rather than `0`, which is a 400.
- `targetDurationMinutes` is genuinely optional. A task with no duration is valid and must render
  as such (an em-dash, not "0 min").

### Remove a task

- A **Remove** action per row → `useRemoveRoutineTask(routineId)`.
- Removing leaves `position` values with a gap. That is fine: the backend only requires positions
  to be unique per routine, and `GET /routines/{id}/tasks` sorts by `position`. **Do not** fire a
  reorder afterwards to close the gap — that's an extra write that can 409 against the Redis lock.
- No confirm dialog; it's cheap to re-add. Canvas 06 shows a plain Remove button.

### Add tasks

- An **Add Tasks** button opening a task picker over the library
  (`useTasks()` — the same paginated hook the Library screen uses).
- Each pick is one `POST /routines/{routineId}/tasks` with `{ taskId }`. **Omit `position`** and let
  the backend append at `max + 1`; supplying a taken position is a 409 for no benefit.
- Adding several: issue them **sequentially**, not `Promise.all`. `@@unique([routineId, position])`
  means concurrent appends race for the same computed position and one will 409.
- **A task already in the routine returns 409.** Filter tasks already present out of the picker,
  and still handle the 409 — the list can go stale between render and tap.

### Reorder (existing) — finish the error path

`useReorderRoutineTasks` is wired but its failure state isn't. Per canvas 06b:

- `taskIds` must contain **every** currently assigned task exactly once, or the backend 400s. The
  existing `move()` in `routine-detail.tsx` does send the full list — keep that invariant if you
  refactor.
- On 409 ("another reorder in progress") show "Order not saved / Another change was in progress.
  The list is back to the last saved order." and **revert to server order** by invalidating.
- On 503, Redis is down — same revert, different copy.

## Acceptance

- [ ] Add, remove and duration edits all update `taskCount` / `totalTargetDurationMinutes` on the
      routine card without a manual refresh (invalidate the routine detail **and** the list).
- [ ] Adding a duplicate task surfaces the "already in this routine" copy, not a generic error.
- [ ] A task with no duration renders as an em-dash and its routine's planned-minutes total is
      still correct.
- [ ] Multi-add of 3+ tasks preserves the picked order and produces no 409.
- [ ] Reorder failure reverts to server order rather than leaving the optimistic order on screen.
- [ ] `tsc`, `expo lint`, `biome ci`, `npm test` clean.
