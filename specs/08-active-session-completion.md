# 08 — Active session: notes, title, and a correct clock

**Status:** not started · **Size:** S–M · **Depends on:** nothing · **Wireframes:** canvas 07, 07b, 2d

`active-session-screen.tsx` covers the stopwatch, per-task stepper, checklist and Finish. Three
things from canvas 07 are missing, one of which is a real bug.

## Scope

### 1. Session notes (missing field)

`CreatePracticeSessionDto.notes` is supported and **never sent**. Canvas 07 has a quiet
"Session notes — optional" field above Finish, and canvas 09 renders those notes on the session
detail — which today can only ever be empty.

- Add the field to the screen and `notes` to `session-store.ts` (persisted, so a backgrounded app
  doesn't lose typing).
- Send it on Finish. Omit the key when empty rather than sending `''`.

### 2. Session title

`CreatePracticeSessionDto.title` is optional, **1–200 characters**. The store seeds `title` from
the routine name but it is not editable. Canvas 07 shows an editable title ("Evening practice").

- Make it editable. If the user clears it, omit `title` entirely — do not send `''`, which fails
  `@Length(1, 200)`.

### 3. The clock is wrong across a restart (bug)

`useStopwatch` is `useState(0)` plus a 1s interval. The task list is persisted to AsyncStorage but
**the elapsed time is not**, so backgrounding and reopening an in-progress session restarts the
clock at 00:00 while the tasks survive. Canvas 07's own annotation calls the clock "Elapsed · on
this device" and the persistence exists precisely so progress isn't lost.

- Persist `startedAt` (an epoch ms number) in `session-store.ts` when a session starts.
- Derive elapsed as `now - startedAt` rather than counting ticks, so it stays correct across
  backgrounding, and the interval only drives re-render.
- The clock is still **local only** — there is no total-elapsed field on the server and one must
  not be invented. Per-task `durationMinutes` remain the only thing persisted.

Tests for anything reading the wall clock must freeze it: `jest.useFakeTimers()` +
`setSystemTime` in `beforeEach`, `useRealTimers` in `afterEach` (see AGENTS.md).

### 4. Exit dialog copy (canvas 07b)

The dialog exists; align its options with the design: **Finish and save** / **Keep practicing** /
**Discard session**, destructive last. "Finish and save" does exactly what Finish does. Discard
needs no request — nothing exists server-side yet.

## Out of scope

- Web keyboard shortcuts (canvas 2d: space completes, ← → move). Nice, not MVP. Note it in
  `11-blocked-and-out-of-scope.md` rather than building it here.
- Recording from inside the session — see `09-recording-upload.md`.

## Acceptance

- [ ] Notes typed during a session appear on the session detail afterwards.
- [ ] An emptied title results in a payload with no `title` key.
- [ ] Backgrounding and reopening an in-progress session preserves elapsed time.
- [ ] A regression test covers the elapsed-time restore, with a frozen clock.
- [ ] `tsc`, `expo lint`, `biome ci`, `npm test` clean.
