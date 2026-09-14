# Guitar Coach FE — MVP completion plan

Written 2026-09-13. Verified against the backend at `../guitar-coach` (`openapi.json`,
`prisma/schema.prisma`, controllers, DTOs, better-auth config) and against
`wireframes/Guitar Coach Wireframes.dc.html`. Not written from memory.

## Where the app actually stands

Better than a first look suggests. The foundation is complete and genuinely finished, not stubbed:
routing, auth, the design system (21 primitives over `src/theme/tokens.ts`), the query layer,
offline handling, the web rail/bottom-bar fork, and 46 passing test suites at ~96% coverage. A
repo-wide search for `TODO`, `FIXME`, "coming soon" and dead handlers returns **nothing**.

What's missing isn't polish — it's whole capabilities. The backend supports routine CRUD, routine-
task management and recording upload/delete; the frontend has transport functions for all of them,
unit-tested, **with zero callers**. Nine transports are wired to nothing.

The practical consequence:

- **You cannot create a routine in the app.** Only the AI Coach can make one.
- **You cannot add a library task to a routine.** The Library is a browsable dead end.
- **You cannot upload a recording.** Playback works; nothing can ever be played.
- **You cannot practice without a routine**, though the backend allows it (the home empty state
  even advertises it, with an inert card).
- **Archived routines are invisible**, while a backend cron archives routines every Monday — so
  routines silently vanish and the app looks broken.

## MVP definition

A user can sign up, build a routine by hand or with the AI, practice it, record it, and review it.
That is the loop. Everything in phases 1–3 below serves it; nothing outside it is in scope.

## Phases

### Phase 1 — Unblock (do first)

| Spec                                                    | Size | Notes                                                        |
| ------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| [01 — API layer foundation](01-api-layer-foundation.md) | S    | Nine mutation hooks + DTO re-exports. Blocks most of phase 2 |
| [06 — Library filters](06-library-filters.md)           | S    | Independent of 01. Good parallel first task                  |

### Phase 2 — Close the loop (the MVP)

| Spec                                                                                 | Size | Depends on |
| ------------------------------------------------------------------------------------ | ---- | ---------- |
| [02 — Routines list: Active/Archived](02-routines-list-and-archive.md)               | M    | 01         |
| [03 — Routine builder: create/edit/archive/delete](03-routine-builder.md)            | L    | 01, 02     |
| [04 — Routine tasks: add/remove/duration](04-routine-task-management.md)             | M    | 01, 03     |
| [05 — Task detail: Add to Routine](05-add-task-to-routine.md)                        | M    | 01         |
| [07 — Practice entry sheet & blank sessions](07-practice-entry-and-blank-session.md) | M    | —          |
| [08 — Active session: notes, title, clock fix](08-active-session-completion.md)      | S–M  | —          |
| [09 — Recordings: upload](09-recording-upload.md)                                    | M    | 01         |

### Phase 3 — Complete the review half

| Spec                                                                                    | Size | Depends on |
| --------------------------------------------------------------------------------------- | ---- | ---------- |
| [10 — Recordings: delete & playback states](10-recording-delete-and-playback-states.md) | S    | 01, 09     |

### Reference

- [00 — API contract reference](00-api-contract-reference.md) — **read before picking up any task**
- [11 — Blocked, deferred, out of scope](11-blocked-and-out-of-scope.md) — read before adding
  anything not listed above

## Parallelisation

After spec 01 lands, these run independently: **06**, **07**, **08** (no dependency on 01 at all),
and **05**, **09**, **02** (need only 01). The routine builder chain **02 → 03 → 04** is the long
pole and should start first.

A reasonable two-track split: one person takes 01 → 02 → 03 → 04 (the builder), another takes
06 → 07 → 08 → 09 → 10. Roughly balanced.

## Rules for anyone picking up a task

1. **Read [00](00-api-contract-reference.md) first.** It is verified against the backend; your
   training data is not. The stack (Expo SDK 57, RN 0.86, React 19.2) is newer than most of it —
   check https://docs.expo.dev/versions/v57.0.0/ before writing Expo or Router code, and say so
   when you couldn't verify something.
2. **Follow `AGENTS.md`.** It documents the traps that cost real debugging time: `await` RNTL 14's
   `render`/`fireEvent`, wrap overlays in `withGluestack`, never `setState(..., true)` on a store,
   never give an `asChild` child an array style, and the five `jest.setup.ts` mocks that each
   unblock an import rather than being conveniences.
3. **Never hand-edit `src/types/api.d.ts`.** Run `npm run api:types`. Model new shapes by
   re-exporting from `src/types/<resource>.ts`; a parallel hand-written type will drift silently.
   API changes are backend-first — CI reads the backend repo's `main`.
4. **Four checks must be clean**, every time:
   ```bash
   npx tsc --noEmit && npx expo lint && npx biome ci . && npm test
   ```
   Coverage floor is 80 on all four metrics with measured ~96/94/97/97. Raise it as coverage
   grows; never lower it to turn a build green.
5. **A green `expo export` is not proof the app runs.** Export builds as production and skips every
   `NODE_ENV !== 'production'` guard in the dependencies. Run it in Expo Go (`npx expo start`) for
   anything that renders.
6. **Don't invent capabilities.** If a wireframe shows something the API can't do, spec 11 probably
   already explains why. If it doesn't, add it there rather than building a convincing fake.

## Testing the MVP end to end

The backend runs in Docker from the sibling repo (`../guitar-coach`, `compose.dev.yaml`). Two
things will bite a first run:

- **`CORS_ORIGINS` must list the Expo web origin** (e.g. `http://localhost:8081`). It feeds both
  `enableCors()` and better-auth's `trustedOrigins` from one value; a mismatch passes CORS and then
  fails the request it was meant to allow.
- **Recordings need GCS.** `GCP_PROJECT_ID` and `GCS_RECORDINGS_BUCKET` must be set, plus
  `GOOGLE_APPLICATION_CREDENTIALS` as a **fully-qualified** path (`~` is not expanded) and
  `GCP_CREDENTIALS_HOST_PATH` for the compose bind-mount. Without these, specs 09 and 10 cannot be
  exercised at all — see the backend's `docs/practice-recordings.md`.
- **The AI endpoints need `OPENAI_API_KEY` / `OPENAI_MODEL`.**

Sanity pass once phases 1–2 land: sign up → browse Library with filters → add a task to a new
routine → set durations and reorder → practice it → finish with notes → see it in History → upload
a recording → play it back → delete it → ask the AI Coach for a routine in both modes → archive and
restore a routine.
