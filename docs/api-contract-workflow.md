# Keeping the backend and frontend types in sync

How an API change travels from `guitar-coach` (NestJS) to `guitar-coach-fe` (Expo), and
exactly which commands to run.

## The mental model

Two committed artifacts form the contract. Neither is ever hand-edited:

| Artifact             | Repo                  | Generated from                | By                         |
| -------------------- | --------------------- | ----------------------------- | -------------------------- |
| `openapi.json`       | `guitar-coach` (root) | The NestJS controllers + DTOs | `npm run openapi:generate` |
| `src/types/api.d.ts` | `guitar-coach-fe`     | The backend's `openapi.json`  | `npm run api:types`        |

The frontend's `src/types/*.ts` files are thin re-exports of `api.d.ts` (e.g.
`export type Task = components['schemas']['TaskResponseDto']`), so a backend field rename
becomes a **compile error** in the app rather than a runtime surprise.

---

## Scenario A — you changed something in the backend

This is the common case: a DTO field, a new endpoint, a changed response shape.

### 1. Backend — regenerate and commit the schema

```bash
cd guitar-coach
npm run openapi:generate     # rewrites openapi.json
git add openapi.json         # commit it alongside your code change
```

Notes:

- The script runs `nest build` first, then boots the Nest app **in memory** to read its
  decorator metadata. It never calls `listen()`, so **Postgres/Redis/RabbitMQ do not need to
  be running** — it only needs env vars that satisfy the Zod schema in
  `src/config/env.validation.ts` (your normal `.env` is fine).
- Without Redis running you'll see `Ignoring error during app.close(): ClientClosedError`.
  **This is expected and harmless** — the file is already written by that point, and the
  script still exits `0`.

### 2. Merge the backend change to `main` — before opening the frontend PR

**This ordering is not optional.** The frontend's CI (`.github/workflows/contract.yml`)
checks out the **`guitarcoach` repo's default branch (`main`)** to read `openapi.json`. If
your backend change is still on a branch, the frontend PR will regenerate types from the
_old_ schema and fail — or, if `openapi.json` doesn't exist there yet, fail with
`ENOENT: no such file or directory '.../backend/openapi.json'`.

Note that merging to backend `main` also triggers the Cloud Run deploy
(`google-cloudrun-docker.yml`), so this is a real release, not just a schema publish.

### 3. Frontend — regenerate types and fix what breaks

```bash
cd guitar-coach-fe
npm run api:types            # rewrites src/types/api.d.ts (auto-formatted with Prettier)
npx tsc --noEmit             # shows every call site the change broke
```

Fix the reported call sites, then commit **both** `src/types/api.d.ts` and your fixes.

If the change added a new schema you want to expose app-wide, re-point the matching file in
`src/types/` at it rather than hand-writing the type:

```ts
import type { components } from '@/types/api';
export type Task = components['schemas']['TaskResponseDto'];
```

---

## Scenario B — frontend-only work

Nothing to run. `api.d.ts` is already committed and current.

## Scenario C — you don't have the backend checked out locally

`api:types` defaults to the sibling path `../guitar-coach/openapi.json`. Two escapes:

```bash
# Point at a checkout somewhere else
BACKEND_OPENAPI_PATH=/path/to/openapi.json npm run api:types

# Or pull from a running server (local or the deployed Cloud Run service)
npm run api:types:remote
```

`api:types:remote` reads `$EXPO_PUBLIC_API_BASE_URL/docs-json`. That env var holds the bare
origin (e.g. `http://localhost:3000`) — `/docs-json` sits at the root, _not_ under the
`/api/v1` prefix, because `SwaggerModule.setup('docs', ...)` in `main.ts` is called without
`useGlobalPrefix`. The browsable Swagger UI is at `/docs`.

---

## Command reference

**Backend (`guitar-coach`)**

| Command                    | What it does                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run openapi:generate` | Rebuild and rewrite `openapi.json` from the current code                                     |
| `npm run openapi:check`    | Regenerate, then fail if `openapi.json` differs from what's committed (this is what CI runs) |

**Frontend (`guitar-coach-fe`)**

| Command                    | What it does                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run api:types`        | Regenerate `src/types/api.d.ts` from the backend's `openapi.json`, then Prettier-format it |
| `npm run api:types:remote` | Same, but read the schema from a running server instead of a file                          |
| `npm run api:types:check`  | Regenerate → fail on any diff → `tsc --noEmit` (this is what CI runs)                      |

---

## What CI enforces automatically

**Backend `ci.yml`** runs `openapi:check` on every PR — catches a DTO change whose
`openapi.json` wasn't regenerated. It supplies fake-but-valid env values (placeholder
`localhost` URLs); these exist only to satisfy the env schema and never connect to anything.

**Frontend `contract.yml`** runs on every PR:

1. Checks out the frontend, then the backend's `main` into `backend/`
2. `npm ci`
3. `npx expo customize tsconfig.json`
4. `npm run api:types:check` with `BACKEND_OPENAPI_PATH=backend/openapi.json`

Step 3 exists because Expo generates `expo-env.d.ts` (which supplies the ambient
`declare module '*.css'` that `import '@/global.css'` needs) and `.expo/types`
(expo-router's typed routes) **only when the dev server starts**. Both are gitignored by
Expo's own convention, so a fresh CI checkout has neither. This is the command Expo
documents for generating them in CI — see
https://docs.expo.dev/router/reference/typed-routes/. You never need to run it locally;
`expo start` already does.

---

## Gotchas

- **Never hand-edit `openapi.json` or `src/types/api.d.ts`.** Both are regenerated and
  diff-checked in CI; edits will be reverted or fail the build.
- **Backend first, always.** See Scenario A step 2 — the most common cause of a red
  frontend PR.
- **`tsconfig.json` excludes `backend/`.** CI checks the backend out into a subdirectory of
  the frontend; without that exclude, `tsc` recurses into the NestJS app (whose dependencies
  aren't installed here) and produces thousands of bogus errors.
- **Two repos, two PRs, two review cycles** for a single API change. This friction is the
  main argument for the monorepo consolidation sketched in
  [`plan/MONOREPO-MIGRATION.md`](../plan/MONOREPO-MIGRATION.md), which would collapse the
  cross-repo checkout into a local file read.

The original implementation plan for this pipeline is in
[`plan/API-CONTRACT-SYNC.md`](../plan/API-CONTRACT-SYNC.md); this document describes the
system as actually built and is the one to keep current.
