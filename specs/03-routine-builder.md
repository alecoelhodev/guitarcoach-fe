# 03 — Routine builder: create, edit, archive, delete

**Status:** not started · **Size:** L · **Depends on:** 01, 02 · **Wireframes:** canvas 06, 06b, 2c

`src/features/routines/routine-detail.tsx` today is read-only apart from up/down reorder. Canvas 06
is explicit that **one screen creates, views and edits** a routine. This is the largest single gap
in the app.

## Scope

Turn `routine-detail.tsx` into the builder, or split it into `routine-builder.tsx` alongside a thin
detail wrapper — implementer's call, but there must be **one** screen, not two divergent ones.

### Create mode

The route is `/routines/[id]`. For create, add `/routines/new` as a sibling route rather than
overloading `[id]` with a sentinel, so the typed-route literal stays honest and `[id]` never has to
mean "or the string `new`".

> **Verify before building**: this assumes expo-router resolves a static segment ahead of a dynamic
> sibling. That is the documented behaviour, but AGENTS.md is explicit that this stack is newer than
> most training data — confirm against
> https://docs.expo.dev/versions/v57.0.0/ first. If it doesn't hold, a modal over the routines list
> is the fallback, and nothing else in this spec changes.

- Title field required, **2–200 characters** (`CreateRoutineDto` — a 1-character title is a 400).
  Validate on blur, per field, never blocking typing (canvas 01b's rule, applied consistently).
- Notes optional. Status defaults to `active`.
- On save: `useCreateRoutine()`, then `router.replace()` to the created routine's `/routines/[id]`
  so the back button doesn't return to an empty create form.
- A routine must exist before tasks can be attached (`POST /routines/{routineId}/tasks` needs an
  id). So in create mode the task list is **not** editable — save first, then add tasks. Say so in
  the UI rather than showing a disabled control with no explanation.

### Edit mode

- Inline-editable title, notes field, and an **Active/Archived** `Segmented` bound to
  `UpdateRoutineDto.status`.
- An **Unsaved** badge plus a **Save** action in the header, matching canvas 06. Track dirty state
  locally; `PATCH /routines/{id}` accepts a partial body, so send only changed fields.
- On leaving with unsaved changes, show the canvas 06b dialog: **Save** / **Discard** /
  **Keep editing**. Use `ConfirmDialog` — and note it portals through `OverlayProvider`, so any
  test must wrap in `withGluestack` from `src/test/gluestack.tsx` or it renders nothing and the
  assertion passes for the wrong reason.

### Archive and delete

- **Archive** is `PATCH { status: 'archived' }` — not a delete. Keep it non-destructive in styling.
- **Delete** is `DELETE /routines/{id}`, confirmed by a dialog. Canvas 06b's copy: "Past sessions
  that followed it are kept, without the link." That is accurate — the session→routine relation is
  optional and nulls on delete.
- **`DELETE` returns 409 while any task is still attached.** This is the one genuinely awkward
  backend constraint in the app. Handle it honestly:
  - If the routine has tasks, the delete dialog must say the tasks will be removed first.
  - Implement delete as: remove each routine task, then delete the routine. Sequentially, not
    `Promise.all` — the backend serialises per-routine writes and a burst invites 409s.
  - If the routine still fails to delete, surface the conflict; never claim success.
  - Alternative, if the above feels too heavy for the MVP: offer **Archive** as the primary action
    and only enable Delete on an already-empty routine. Pick one and write it down in the PR.

### Destructive-action placement

Canvas 1h is explicit: destructive actions go **last** and are never adjacent to the confirm
button. Keep Archive/Delete in a footer row, Delete last.

## Out of scope

- Drag-and-drop reordering. No DnD library is installed, and canvas 06 states Move up / Move down
  must work anyway ("ordering never requires a drag"). Buttons are sufficient and already exist.
  Adding a DnD dependency is new functionality — don't.
- Task add/remove/duration — that's `04-routine-task-management.md`.

## Acceptance

- [ ] Create → save → lands on the new routine's detail, and it appears in the Active list.
- [ ] Edit title/notes/status persists and the list card updates without a manual refresh.
- [ ] Leaving dirty prompts; Discard really discards; Keep editing cancels navigation.
- [ ] Title shorter than 2 characters is caught client-side before the request.
- [ ] Delete on a routine with tasks either removes them first or is correctly disabled — and a 409
      is never shown as a generic error.
- [ ] Tests wrap `ConfirmDialog` in `withGluestack`; `render`/`fireEvent` are **awaited** (RNTL 14).
- [ ] `tsc`, `expo lint`, `biome ci`, `npm test` clean.
