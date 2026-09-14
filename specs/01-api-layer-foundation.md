# 01 — API layer foundation

**Status:** not started · **Size:** S · **Blocks:** 02, 03, 04, 05, 07, 08 · **Depends on:** nothing

Every remaining spec needs query hooks that don't exist yet. Nine transports in `src/api/*.ts` are
fully written and unit-tested but have **no `.queries.ts` hook and no consumer**:

```
createRoutine  updateRoutine  deleteRoutine
addRoutineTask  updateRoutineTask  removeRoutineTask
uploadRecording  deleteRecording
deleteSessionsByTitle            <- stays unwired, see 11-blocked-and-out-of-scope.md
```

Do this first, in one PR, so the screen specs can be picked up in parallel afterwards.

## Scope

Add mutation hooks only. **Do not** write UI, and **do not** add new transport functions — the
transports already exist and match the backend. Read `00-api-contract-reference.md` first.

### `src/api/routines.queries.ts`

Add:

- `useCreateRoutine()` — on success, invalidate `queryKeys.routinesRoot`.
- `useUpdateRoutine(routineId)` — invalidate `queryKeys.routine(routineId)` **and**
  `queryKeys.routinesRoot` (status edits move a routine between the Active and Archived lists).
- `useDeleteRoutine()` — invalidate `queryKeys.routinesRoot`; remove `queryKeys.routine(id)`.
- `useAddRoutineTask(routineId)`, `useUpdateRoutineTask(routineId)`, `useRemoveRoutineTask(routineId)`
  — each invalidates `queryKeys.routineTasks(routineId)` **and** `queryKeys.routine(routineId)`,
  because `taskCount` / `totalTargetDurationMinutes` are server-computed and go stale otherwise.
  Also invalidate `queryKeys.routinesRoot` so the list cards' counts follow.

### `src/api/recordings.queries.ts`

- `useUploadRecording(sessionId)` — invalidate `queryKeys.recordings(sessionId)`.
- `useDeleteRecording(sessionId)` — same invalidation. Takes `sessionId` for the key even though
  the endpoint is keyed by `recordingId`.

## Types

Re-export the request DTOs these hooks take, in the existing thin-re-export style. Do not
hand-write parallel shapes and do not import `components['schemas']` outside `src/types/`.

In `src/types/routine.ts`:

```ts
export type CreateRoutineInput = components['schemas']['CreateRoutineDto'];
export type UpdateRoutineInput = components['schemas']['UpdateRoutineDto'];
export type AddRoutineTaskInput = components['schemas']['AddRoutineTaskDto'];
export type UpdateRoutineTaskInput = components['schemas']['UpdateRoutineTaskDto'];
```

In `src/types/session.ts`: `CreateSessionInput` ← `CreatePracticeSessionDto`.

## Error mapping

`src/api/errors.ts`'s `describeError` is the single place user-facing copy is derived. The new
conflict states are real, designed states — not generic failures. Extend it (or pass an explicit
override at each call site) so these render the wireframe's wording rather than a generic message:

| Status                       | Where                | Copy the wireframes ask for                                               |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------- |
| 409 on `addRoutineTask`      | Add-to-routine sheet | "This task is already in `<routine>`. Change its duration there instead." |
| 409 on `deleteRoutine`       | Routine builder      | Routine still has tasks — remove them first                               |
| 409 on `reorderRoutineTasks` | Routine builder      | "Order not saved — another change was in progress."                       |
| 404 on `resolvePracticePlan` | AI Coach             | "This draft has expired"                                                  |

Keep `shouldRetry` as-is: **4xx must not be retried.** A 409 retried automatically would produce a
confusing double-failure.

## Acceptance

- [ ] All nine hooks exist, typed, with the invalidations above.
- [ ] A unit suite per hook in `src/api/__tests__/` covering success + the documented conflict
      status, following the existing `routines.queries.test.tsx` pattern (real `QueryClient` via
      `src/test/query-client.tsx`, transport mocked).
- [ ] `npx tsc --noEmit`, `npx expo lint`, `npx biome ci .`, `npm test` all clean.
- [ ] Coverage stays at or above the floor in `jest.config.js`. Never lower the floor.
