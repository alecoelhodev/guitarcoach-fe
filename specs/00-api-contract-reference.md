# 00 — API contract reference

Shared, non-negotiable context for every spec in this folder. Read this before picking up a task.
Verified on 2026-09-13 against `../guitar-coach` (`openapi.json`, `prisma/schema.prisma`, controllers,
DTOs) — not from memory. If you change anything here, re-verify against the backend first.

> The frontend's generated types come from `src/types/api.d.ts`. **Never hand-edit it** — run
> `npm run api:types`. Model a new shape by re-exporting it from `src/types/<resource>.ts`.

## Auth (better-auth, mounted at bare `/auth`, outside `/api/v1`)

Better Auth 1.6.x, email + password, `basePath: '/auth'`. **These routes are not in `openapi.json`**
and never will be — they are Express middleware, not Nest controllers, so they never reach Swagger.

| Route                        | Purpose                       | Notes                            |
| ---------------------------- | ----------------------------- | -------------------------------- |
| `POST /auth/sign-up/email`   | Create account                | Rate limited **3/min**           |
| `POST /auth/sign-in/email`   | Sign in, sets httpOnly cookie | Rate limited **5/min**           |
| `POST /auth/sign-out`        | Clear session                 |                                  |
| `GET /auth/get-session`      | Current session               |                                  |
| `POST /auth/forget-password` | Send reset link               | Already wired                    |
| `POST /auth/reset-password`  | Consume reset token           | **Not wired — see Blocked work** |

- The cookie is the credential. `src/stores/session-store.ts` caches the last-known user purely
  for an instant boot gate — it is **not** the credential and must never be treated as one.
- `emailVerification.sendOnSignUp: true`, but `requireEmailVerification` is **not** set, so an
  unverified user can sign in normally. `emailVerified` is exposed on `GET /users/me`.
- The `admin` plugin is enabled (`/auth/admin/*`), `defaultRole: 'user'`. **Out of scope** — this
  app ships no admin surface (the wireframes state this explicitly). There is no self-service
  promotion path: becoming admin requires an existing admin or a direct Postgres edit.
- Password length is **8–128**. Sessions last 7 days with a 24h sliding refresh.
- Unmatched `/auth/*` routes fall back to **100 requests / 10s**. `/auth/change-password` and
  `/auth/change-email` are 3/10s.

> **Web deployment gotcha.** The session cookie is `SameSite=Lax` and is not configured otherwise.
> A web build served from a different registrable domain than the API will sign in successfully
> and then silently fail every authenticated request, because the browser won't return the cookie.
> Different ports on `localhost` are fine. Keep the web origin same-site with the API, and make
> sure it is listed in the backend's `CORS_ORIGINS` (which feeds both `enableCors()` and
> better-auth's `trustedOrigins`).

### Blocked: email delivery is a stub

`src/auth/email.ts` in the backend does **not** send email. Both `sendVerificationEmail` and
`sendResetPasswordEmail` `console.log` the URL and resolve. Password-reset completion and email
verification therefore cannot be exercised end to end without reading backend logs. See
`11-blocked-and-out-of-scope.md`.

## Conventions that hold across every `/api/v1` route

- **Auth**: a global `AuthGuard` protects everything. Assume authenticated unless stated.
- **Ownership leaks nothing**: acting on another user's routine/session/recording returns
  **404**, never 403. Treat 404 on a detail route as "gone", not "forbidden".
- **Validation**: global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`. Sending an
  unrecognised body property is a **400**, not a silent drop. Send exactly the documented fields.
- **Pagination**: `page` (min 1, **default 1**) and `limit` (min 1, **max 100, default 20**).
  Response is `{ data: T[], meta: { total, page, limit, totalPages } }`.
- **There is no search parameter on any endpoint.** See Non-capabilities below.
- **No rate limiting applies to `/api/v1/*`** — only to `/auth/*`.
- `GET /api/v1` is the bare API root and **requires auth**. It is not a public health check; use
  `/health/live` and `/health/ready` for that (those are the only genuinely public routes).

## Enums

```
RoutineStatus   active | archived
TaskCategory    technique | theory | repertoire
TaskDifficulty  easy | medium | hard
```

## Tasks — read-only catalog

| Route                                              | Access                               |
| -------------------------------------------------- | ------------------------------------ |
| `GET /api/v1/tasks?page&limit&category&difficulty` | authenticated                        |
| `GET /api/v1/tasks/{id}`                           | authenticated                        |
| `POST`/`PATCH`/`DELETE /api/v1/tasks`              | **admin only** (`@Roles(['admin'])`) |

Tasks are a **shared catalog with no per-user ownership** — every user sees the same tasks. Ordinary
users can browse and filter only. Do not build create/edit/delete UI.

`TaskResponseDto { id, title, createdAt, updatedAt, category?, difficulty?, referenceLink?, description? }`

## Routines — full CRUD, user-scoped

| Route                                    | Body / notes                                                          |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `POST /api/v1/routines`                  | `CreateRoutineDto { title (2–200, required), status?, notes? }` → 201 |
| `GET /api/v1/routines?page&limit&status` | paginated                                                             |
| `GET /api/v1/routines/{id}`              |                                                                       |
| `PATCH /api/v1/routines/{id}`            | `UpdateRoutineDto { title?, status?, notes? }`                        |
| `DELETE /api/v1/routines/{id}`           | 204 — **409 if tasks are still attached**                             |

`RoutineResponseDto { id, userId, title, status, taskCount, totalTargetDurationMinutes, createdAt, updatedAt, notes? }`

**`taskCount` and `totalTargetDurationMinutes` are computed server-side** and already on the list
response — do not re-derive them by fetching each routine's tasks.

### Routine tasks

| Route                                                | Body / notes                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `POST /api/v1/routines/{routineId}/tasks`            | `AddRoutineTaskDto { taskId (uuid), position? (≥1), targetDurationMinutes? (≥1) }` |
| `GET /api/v1/routines/{routineId}/tasks`             | `RoutineTaskWithTaskResponseDto[]`, ordered by `position`                          |
| `PATCH /api/v1/routines/{routineId}/tasks/reorder`   | `{ taskIds: string[] }`                                                            |
| `PATCH /api/v1/routines/{routineId}/tasks/{taskId}`  | `UpdateRoutineTaskDto { position?, targetDurationMinutes? }`                       |
| `DELETE /api/v1/routines/{routineId}/tasks/{taskId}` | 204                                                                                |

Schema: `@@id([routineId, taskId])`, `@@unique([routineId, position])`.

- **A task can appear at most once per routine.** Adding a duplicate → **409**. This is the
  wireframe's "already in this routine" state.
- **Position is unique per routine.** Supplying a taken `position` → **409**. Omit `position` and
  the backend appends (`max + 1`) — prefer omitting it.
- **Reorder must send the complete set**: `taskIds` must contain every currently-assigned task
  exactly once (min length 1, each a UUID), or **400**. It is a full reorder, never a partial move.
- Reorder is serialised per routine with a Redis lock. A second concurrent reorder → **409**
  ("Another reorder is already in progress"); Redis unavailable → **503**. This is the
  wireframe's "Order not saved" state.
- Adding a `taskId` that does not exist → **404**.

## Practice sessions — write-once

| Route                                            | Notes                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `POST /api/v1/practice-sessions`                 | `CreatePracticeSessionDto { title? (1–200), notes?, routineId? (uuid), tasks? }` |
| `GET /api/v1/practice-sessions?page&limit`       | paginated                                                                        |
| `GET /api/v1/practice-sessions/{sessionId}`      |                                                                                  |
| `DELETE /api/v1/practice-sessions?title=<exact>` | bulk by exact title → `{ deletedCount }`                                         |

`CreatePracticeSessionTaskDto { taskId (uuid), durationMinutes? (int ≥1), completed? }`

- **There is no update endpoint.** A session is written once, on Finish. Starting practice creates
  nothing server-side; all in-progress state is local
  (`src/features/session/session-store.ts`). Finish is the last chance to correct the numbers.
- **There is no total-elapsed field.** Every total is a client-side sum of per-task
  `durationMinutes`, which are **optional** — totals must render correctly when minutes are absent.
- **`≥1` means `0` is a 400, and TypeScript will not catch it.** `class-validator`'s `@Min(1)` does
  not survive into `src/types/api.d.ts` — the generated shape is a bare `durationMinutes?: number`.
  The same applies to `position` and `targetDurationMinutes` on routine tasks. A minutes control
  that can reach zero must **omit** the key, never send `0`; the field is optional precisely so it
  can be left out. This shipped as a bug once: the active session seeded every untargeted task to
  `0` and every Finish containing one was rejected.
- `@@id([practiceSessionId, taskId])` — a task may appear at most once per session. **A duplicate
  `taskId` in the `tasks[]` array is not validated and surfaces as a generic 500**, unlike the
  clean 409s elsewhere. Dedupe client-side before sending.
- `routineId` is validated for ownership; referencing a routine you don't own → 404. Deleting a
  routine later **nulls** the link on past sessions (optional relation, `SetNull`) — sessions
  survive, which is what the wireframe's delete dialog promises.
- `DELETE ?title=` is exact-match, required, and only ever touches the caller's own sessions. It
  exists for the k6 load tests. **Do not build UI for it** — see `11-blocked-and-out-of-scope.md`.

## Recordings

| Route                                                   | Notes                                            |
| ------------------------------------------------------- | ------------------------------------------------ |
| `POST /api/v1/practice-sessions/{sessionId}/recordings` | **multipart/form-data, field name `file`** → 201 |
| `GET /api/v1/practice-sessions/{sessionId}/recordings`  | `RecordingResponseDto[]`                         |
| `GET /api/v1/recordings/{recordingId}/download-url`     | `{ url }`, **expires in 900s (15 min)**          |
| `DELETE /api/v1/recordings/{recordingId}`               | 204 — deletes the GCS object too, irreversible   |

Allowed content types (backend `recording-file-filter.ts`, already mirrored in
`src/lib/file-validation.ts` — keep the two in sync):

```
audio/mpeg  audio/wav  audio/x-wav  audio/mp4  audio/x-m4a  audio/ogg  audio/webm
```

Max size default **50 MB** (`RECORDING_UPLOAD_MAX_SIZE_BYTES`). Rejected type → 400.

The download URL is temporary — request a fresh one per play (already done in
`src/features/history/recording-row.tsx`). An expired link is a real state, not an edge case.

## AI — two separate endpoints with different contracts

### `POST /api/v1/ai/practice-planner` — Draft & Review (confirmation-gated)

`PracticePlannerRequestDto { prompt?, confirmation?, previousResponseId? }`, returns one of:

```ts
{ status: 'awaiting_confirmation', plan: PracticePlan, previousResponseId: string }
{ status: 'created',   routine: { routineId, title, taskCount } }
{ status: 'cancelled' }
```

- Step 1 sends `prompt`; **nothing is persisted**. Step 2 sends `previousResponseId` +
  `confirmation: true` to persist, or `false` to cancel.
- **The pending plan expires after 15 minutes** (`PLAN_OWNERSHIP_TTL_MS = 15 * 60 * 1000`).
  Confirming an expired or non-owned id → **404** ("Practice plan not found or expired").
- **Confirming creates brand-new catalog `Task` rows** from the model's titles/descriptions, then
  attaches them. AI-planned routines do not reuse existing library tasks — the library grows.
- `prompt` is **1–2000 characters**.
- The plan is re-validated server-side: at least one task, positive durations, and the task
  durations must sum to within **±20%** of the stated total, or it's a 502.
- Errors: invalid body → 400, malformed model output → 502, OpenAI outage/rate-limit → 503,
  timeout → 504 (client timeout is **30s**, `OPENAI_REQUEST_TIMEOUT_MS`).

### `POST /api/v1/ai/routine-coach` — Instant Create (no confirmation)

`RoutineCoachRequestDto { message (required) }` → `RoutineCoachResponseDto { message, routineId?, routineTitle?, taskCount? }`

- Persists on success in the same request. There is nothing to confirm.
- Unlike the planner, its `create_routine` tool may **only use existing task IDs** — it never
  invents catalog tasks.
- `routineId` is absent when the agent answered without creating anything. Treat the optional
  fields as genuinely optional.
- `message` is **3–1000 characters** — shorter than the planner's `prompt`. A two-character message
  is a 400.
- Server-side caps on what it will create: **≤20 tasks**, **≤120 min per task**, **≤240 min total**.
- A client-side timeout does **not** mean nothing was created — the wireframe's timeout copy tells
  the user to check their routines. Preserve that wording.
- Errors: guardrail trip or malformed tool args → 400, max turns (8) or tool failure → 502,
  OpenAI outage → 503, timeout → 504.

## Users

| Route                                                      | Access                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/users/me`                                     | authenticated → `MeResponseDto { id, email, name, emailVerified, role?, image?, createdAt, updatedAt }` |
| `GET /api/v1/users`, `GET/PATCH/DELETE /api/v1/users/{id}` | **admin only**                                                                                          |

**`PATCH /users/{id}` is admin-gated**, so an ordinary user cannot edit their own profile through
the REST API. The Profile screen is read-only by design, and the wireframes agree. Any future
profile editing would have to go through better-auth's own `/auth/update-user`, which is **not in
scope** for the MVP.

## Non-capabilities — do not build these

The wireframes imply a few things the backend cannot do. Building them means inventing
functionality, which this plan explicitly excludes.

| Wireframe element                        | Reality                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Search input on Task Library             | `FindTasksQueryDto` has **no** search/`q` field — only `page`, `limit`, `category`, `difficulty`    |
| Search input on the routine-picker sheet | `FindRoutinesQueryDto` has **no** search field either                                               |
| Streaming/step-by-step AI progress ticks | Both AI endpoints are single request/response. Show indeterminate progress, not fake resolved steps |
| Analytics, streaks, charts, scores       | No analytics endpoint exists. "This week" is client-derived from the sessions list                  |
| Editing a finished session               | No update endpoint                                                                                  |
| Task create/edit/delete                  | Admin-gated                                                                                         |
| Profile editing, avatar upload           | Admin-gated (`PATCH /users/{id}`)                                                                   |

Where a spec needs a filter the backend lacks, it says so and scopes the field out rather than
faking it client-side over a partial page.

## Background behaviour the UI must account for

A scheduled Cloud Run Job (`src/weekly-routine-cleanup/`) **archives every routine still `active`
that was created before the current week** — week starting **Monday 00:00 in
`ROUTINE_CLEANUP_TIME_ZONE` (default UTC)**. Routines therefore disappear from the default
`status=active` list on their own. This is precisely why the Routines screen needs an
Active/Archived segment and a Restore action (`02-routines-list-and-archive.md`) — without it,
routines silently vanish and the app looks broken.

> Note: `src/lib/date-grouping.ts`'s `startOfWeek` uses **Sunday** as the week start, while the
> backend cleanup boundary is **Monday**. These are different concepts (a display grouping vs. an
> archive cutoff) and the mismatch is currently harmless, but don't assume they agree.
