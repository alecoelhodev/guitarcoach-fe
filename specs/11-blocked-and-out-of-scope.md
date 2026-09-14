# 11 — Blocked, deferred, and deliberately out of scope

Not a task. This is the list of things someone will otherwise reasonably try to build, and the
reason not to. The brief for this plan was to cover the user flows the backend actually supports
and **add no extra functionality** — most entries below are here because building them would mean
inventing a capability rather than exposing one.

## Blocked on the backend

### Password reset completion

`POST /auth/forget-password` is wired (`auth-form.tsx`'s "Forgot password?"), and the backend's
`/auth/reset-password` route exists. But `sendResetPasswordEmail` in the backend's
`src/auth/email.ts` **only `console.log`s the URL and resolves** — no email is ever sent, in dev or
prod as currently written.

Completing this needs, in order:

1. A real email provider wired into the backend's two senders.
2. A deep link / universal link into the app carrying the token (`expo-linking` is a dependency;
   `app.config.ts` would need the scheme and associated-domain setup).
3. A reset-password screen consuming the token.

Steps 2 and 3 are frontend work, but shipping them against a stub sender would produce a flow that
looks complete and can never succeed. **Leave the request-only flow as-is until the backend sends
mail.**

### Email verification

Same root cause. `sendVerificationEmail` is the same kind of stub, and `sendOnSignUp: true` means
every new user is already being sent a (logged, undelivered) link.

Note that `requireEmailVerification` is **not** set, so an unverified user signs in and uses the app
normally — nothing is gated on it. `emailVerified` is available on `GET /users/me` if a banner is
ever wanted, and `/auth/send-verification-email` exists for a resend. The wireframes only ever show
this as a banner on the sign-in screen, never as its own screen. **Deferred, not missing.**

## Backend capabilities with no UI, deliberately

| Capability                                                                               | Why no UI                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DELETE /practice-sessions?title=`                                                       | Bulk delete by exact title. It exists for the k6 load tests to clean up after themselves (`docs/performance-testing.md`). Exposing "delete every session with this exact title" to users is a foot-gun with no designed screen. `deleteSessionsByTitle` stays in the transport layer, tested and unused. |
| `POST/PATCH/DELETE /tasks`                                                               | Admin-gated (`@Roles(['admin'])`). The wireframes state "Tasks are shared and read-only" and list task creation under "deliberately absent".                                                                                                                                                             |
| `GET/PATCH/DELETE /users/{id}`, `GET /users`                                             | Admin-gated. Canvas 11's annotation: "No admin or user management."                                                                                                                                                                                                                                      |
| `/auth/admin/*`                                                                          | Admin plugin routes. Same reason. No self-service path to becoming admin exists anyway.                                                                                                                                                                                                                  |
| `/auth/update-user`, `/auth/change-password`, `/auth/delete-user`, `/auth/list-sessions` | Real better-auth routes, but no wireframe covers them. Canvas 11 shows Profile as read-only with Display name / Email / Member since, and future settings explicitly inert ("Soon" badges). Adding account management is new product surface.                                                            |

## Designed but unbuildable as drawn

| Wireframe element                                               | Reason                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Search on Task Library (canvas 03)                              | `FindTasksQueryDto` has no search field                                                                                 |
| "Find a routine" search in the add-to-routine sheet (canvas 04) | `FindRoutinesQueryDto` has no search field                                                                              |
| AI Coach step-by-step progress ticks (canvas 10c)               | Neither AI endpoint streams; both are single blocking responses. Show indeterminate progress, never fake resolved steps |
| Streaks, charts, scores                                         | No analytics endpoint. Canvas 02's own annotation says two numbers only, and that the backend does not produce more     |
| Editing a finished session                                      | No update endpoint — sessions are write-once                                                                            |
| Waveform display on recordings                                  | Listed under canvas 1h's "deliberately absent"                                                                          |

Adding a real search parameter to `/tasks` would be a reasonable **backend** change, and would then
unlock canvas 03's search field. That is a backend ticket, not frontend work, and it is out of
scope for this MVP.

## Deferred polish (buildable, not MVP)

- Drag-and-drop task reordering. No DnD library is installed and canvas 06 requires Move up / Move
  down to work regardless, so the buttons are sufficient. Adding a dependency is not free — check
  `bundledNativeModules.json` first if this is ever revisited.
- Web keyboard shortcuts in the active session (canvas 2d: space completes, ← → move).
- The web drag-and-drop upload drop zone (canvas 2e).
- Two-pane list/detail layouts at ≥1024px (canvas 2b/2c/2e). The web rail and breakpoint
  (`use-is-wide`, 768px) already exist; full two-pane is a layout project of its own.
- Route-level tests. Per AGENTS.md, `expo-router/testing-library` is built against RNTL 13's
  synchronous `render` and does not work under RNTL 14; `collectCoverageFrom` excludes `src/app/**`
  for that reason. Not a gap to close on our side.

## Known backend rough edges (worth a backend ticket, not a frontend workaround)

Found while auditing. None block the MVP; all are worth filing upstream.

1. **Duplicate `taskId` in `POST /practice-sessions`'s `tasks[]` returns a generic 500**, not a
   clean 409 — the composite PK violation is unhandled. The frontend dedupes client-side
   (`07-practice-entry-and-blank-session.md`), but the backend should map P2002 here like
   `TasksService` and `RoutinesService` already do.
2. **`DELETE /users/{id}` can 500 instead of 409** when the user owns routines, sessions or
   recordings — `UsersService.remove` catches P2025 but not P2003. Admin-only, so no user-facing
   impact today.
3. **`DELETE /practice-sessions?title=` orphans GCS objects.** It deletes recording rows directly
   in a transaction, bypassing `RecordingsService.remove`, so the audio files stay in the bucket
   forever. Invisible through the API; a storage-cost issue.
