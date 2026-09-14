# 07 — Practice entry sheet & blank sessions

**Status:** not started · **Size:** M · **Depends on:** nothing (01 not required) · **Wireframes:** canvas 02b, 07b, 1a

Two connected gaps:

1. The **Practice** action is the dominant affordance in the whole design — the raised centre
   button on mobile, the first filled rail item on web. Today `PRACTICE_HREF` in
   `src/components/nav/destinations.ts` just navigates to the routines list. Canvas 02b says it
   opens a **choice sheet**.
2. **Blank sessions do not exist.** `src/features/home/home-empty-state.tsx` has an "Or just play"
   card that is deliberately inert — its own comment says "blank sessions are not built yet, so it
   sets the expectation without offering a dead end." The backend supports them fully:
   `routineId` and `tasks` on `CreatePracticeSessionDto` are both optional.

## Scope

### Practice choice sheet (canvas 02b)

A bottom sheet over the current screen — dismissible by swipe, not a route:

- Header "Start practice".
- **From a routine**: active routines listed inline with name / task count / minutes, so a one-tap
  start needs no second navigation. Use `useRoutines({ status: 'active' })`; the card data
  (`taskCount`, `totalTargetDurationMinutes`) is already on the list response.
- **Start a blank session** secondary button, with the helper "Pick tasks from the library as you go."
- On web, canvas 2g calls for a popover under the rail's Practice button rather than a bottom
  sheet. Same content either way.

Picking a routine does what `routine-detail.tsx`'s Start Practice already does: seed
`useActiveSessionStore` with the routine's ordered tasks, then `router.push('/session/active')`.
**Nothing is written to the server** — sessions are write-once on Finish.

### Blank session support

`session-store.ts` currently only has `start` / `setTaskMinutes` / `toggleTaskCompleted` / `reset`.
Add:

- `addTask(task)` and `removeTask(taskId)`, so tasks can be picked mid-session.
- Starting blank means `start({ tasks: [] })` — no `routineId`, no title.

Then in `active-session-screen.tsx` (canvas 07b's "blank-session task picker"):

- When the session has no tasks, show the picker rather than an empty checklist.
- An **Add task** affordance available throughout, not only at the start.
- A task may appear **at most once per session** (`@@id([practiceSessionId, taskId])`) — dedupe on
  add. The backend does **not** validate this cleanly: a duplicate `taskId` in the Finish payload
  hits the composite primary key and comes back as a generic **500**, not a 409. Client-side
  dedupe is the only thing standing between the user and an unexplained failure.

On Finish, omit `routineId` entirely when blank. Do not send `null` — the global `ValidationPipe`
uses `forbidNonWhitelisted` and `@IsUUID()`, so `null` is a 400 while omission is valid.

## Notes

- Keep the three practice entry points canvas 05 calls out as deliberate: Home's today card, the
  central Practice action, and a routine's own Start Practice. All three write nothing until Finish.
- Replace the inert "Or just play" card in `home-empty-state.tsx` with a real action once blank
  sessions work, and drop the now-stale comment.

## Acceptance

- [ ] The Practice action opens the sheet on mobile and the popover on web; neither is a route.
- [ ] Starting from a routine pre-loads its tasks in order with their target durations.
- [ ] A blank session can add tasks from the library, finish, and appear in History with no routine.
- [ ] A blank session's Finish payload contains no `routineId` key at all.
- [ ] Adding the same task twice is prevented.
- [ ] `tsc`, `expo lint`, `biome ci`, `npm test` clean.
