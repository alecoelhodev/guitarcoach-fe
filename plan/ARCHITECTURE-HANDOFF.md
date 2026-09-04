# Guitar Coach FE — architecture handoff

Reviewed against the repo as it stands (Expo SDK 57.0.15, RN 0.86.2, React 19.2.3,
Expo Router 57, TypeScript 6.0).

The setup plan was executed further than expected: route groups with a session gate, an
`api/` layer, 17 UI primitives, 8 feature folders, the Organic token layer, lint and format.
This document is a **restructure proposal on top of that**, not a rebuild. Most of what
follows is wiring and discipline rather than new surface.

**Before writing code:** `AGENTS.md` requires reading
https://docs.expo.dev/versions/v57.0.0/ first. Every version claim below is marked
_verify_ where I could not confirm it against SDK 57 from here.

---

## Verdict up front

| Your proposal                  | Verdict                             | Why                                                                   |
| ------------------------------ | ----------------------------------- | --------------------------------------------------------------------- |
| Expo Router                    | **Already done**                    | Route groups, auth gate, platform forks all in place                  |
| TanStack Query                 | **Installed, under-wired**          | Three real gaps — §2. This is the highest-value work in this document |
| Zustand                        | **Already done, needs persistence** | Two correctly-scoped stores; one has a data-loss bug — §3             |
| Reanimated 4 + Gesture Handler | **Already done**                    | 4.5.1 + worklets 0.10.1, `GestureHandlerRootView` mounted             |
| Type sharing                   | **OpenAPI codegen**                 | NestJS emits the schema; the app generates types from it. §1          |
| NativeWind                     | **Optional, decide now or never**   | §4                                                                    |
| Tamagui / Gluestack            | **No**                              | §5                                                                    |

Two of the three things you asked about are largely done. The gaps are concentrated in
TanStack Query's runtime wiring and in the API contract.

---

## 1. Type sharing — OpenAPI codegen

**The mechanism: the backend emits an OpenAPI schema, the app generates TypeScript from it.**

The two projects are separate repos with separate release cycles, so the contract between
them has to be a file, not an import. NestJS already holds everything needed to produce that
file — the controllers describe the routes and the DTOs describe the shapes. Turning that
into a schema is configuration, not annotation, and the app regenerates its types from the
schema on demand.

The result is what you were after: rename a field server-side, run the generate script, and
`tsc` fails on every line in the app that still expects the old name. No runtime surprise,
no hand-maintained mirror of the backend's types.

### Backend — one-time, small

```bash
npm i @nestjs/swagger
```

Add `SwaggerModule` in `main.ts`, decorate DTOs with `@ApiProperty`, and add a script that
writes `openapi.json` to disk. NestJS's CLI plugin (`"plugins": ["@nestjs/swagger"]` in
`nest-cli.json`) infers most of the decorators from existing TypeScript types, so this is
mostly configuration rather than annotation.

_Verify:_ the backend folder was not mounted for this review — check whether
`@nestjs/swagger` is already a dependency before adding it.

### Frontend

```bash
npm i -D openapi-typescript
npm i openapi-fetch
```

```jsonc
// package.json
"scripts": {
  "api:types": "openapi-typescript ../guitar-coach/openapi.json -o src/types/api.d.ts"
}
```

Point it at the committed `openapi.json` if the repos sit side by side, or at the running
server's `/openapi.json` in CI — `openapi-typescript` accepts a path or a URL.

### The regeneration workflow

Three scripts, covering the three moments the schema can change.

**Backend — emit the schema without booting a server.** `SwaggerModule.createDocument`
only needs the Nest application context, so this runs in a couple of seconds and is safe in
CI and in a pre-commit hook.

```ts
// guitar-coach/scripts/generate-openapi.ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('Guitar Coach API')
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build();
  writeFileSync('openapi.json', JSON.stringify(SwaggerModule.createDocument(app, config), null, 2));
  await app.close();
}

main();
```

```jsonc
// guitar-coach/package.json
"scripts": {
  "openapi:generate": "ts-node scripts/generate-openapi.ts",
  "openapi:check": "npm run openapi:generate && git diff --exit-code openapi.json"
}
```

Commit `openapi.json`. It is the artifact the two repos agree on, and having it in git
history means a contract change shows up in code review as a diff rather than as a broken
build downstream.

**Frontend — generate, watch, and verify.**

```jsonc
// guitar-coach-fe/package.json
"scripts": {
  "api:types": "openapi-typescript ../guitar-coach/openapi.json -o src/types/api.d.ts",
  "api:types:remote": "openapi-typescript $EXPO_PUBLIC_API_BASE_URL/openapi.json -o src/types/api.d.ts",
  "api:types:watch": "chokidar ../guitar-coach/openapi.json -c 'npm run api:types'",
  "api:types:check": "npm run api:types && git diff --exit-code src/types/api.d.ts && tsc --noEmit"
}
```

```bash
npm i -D openapi-typescript chokidar-cli
```

**Day to day.** Run the watcher in a third terminal next to `expo start` and the backend's
`nest start --watch`:

```bash
# terminal 1 — backend
cd guitar-coach && npm run start:dev

# terminal 2 — regenerate openapi.json whenever a DTO or controller changes
cd guitar-coach && npx chokidar 'src/**/*.ts' -c 'npm run openapi:generate'

# terminal 3 — regenerate app types whenever the schema changes
cd guitar-coach-fe && npm run api:types:watch
```

Change a DTO and the type error surfaces in the editor within a second or two, before the
app is even reloaded.

**Backend pre-commit hook** — keeps the committed schema honest without anyone remembering:

```bash
# guitar-coach/.husky/pre-commit
npm run openapi:generate && git add openapi.json
```

**CI.** Run `openapi:check` on the backend to catch a schema change that was not committed,
and `api:types:check` on the frontend to catch app code that no longer matches. The second
one is the gate that matters: it regenerates, fails on any diff, then type-checks the whole
app against the fresh types.

```yaml
# .github/workflows/contract.yml (frontend)
- run: npm ci
- run: npm run api:types:check
```

One caveat on `api:types:remote`: it needs the API running and reachable, so keep it for CI
against a deployed environment. Local work should read the committed file — it is faster and
works offline.

**What this replaces.** `src/types/*.ts` is seven hand-written files today:

```ts
// src/types/task.ts — hand-written, drifts silently
export type Task = {
  id: string;
  title: string;
  category?: TaskCategory;
  // ...
};
```

Nothing connects that to the backend. If a field is renamed server-side, the app compiles
fine and breaks at runtime. After codegen:

```ts
import type { components } from '@/types/api';
export type Task = components['schemas']['TaskDto'];
```

Run `api:types` in CI as well as locally, and fail the build on a diff — that is what stops
the two repos drifting quietly between releases.

**Migration order:** generate the types first, then re-point `src/types/*.ts` to re-export
from `api.d.ts` one resource at a time. Keeping the local aliases means no import churn
across the feature folders, and it gives you a place to hang app-only types that have no
server equivalent.

**Keep `api/client.ts`.** It is well-built — the `/api/v1` prefix handling, the `unprefixed`
escape for `/auth/*`, `credentials: 'include'`, the RN `FormData` cast for uploads with its
explanatory comment. `openapi-fetch` is optional; the value here is the _types_, not the
fetch wrapper. If you adopt it, do it after the types land, and preserve the upload path —
`openapi-fetch` will not handle RN's non-standard `FormData` file shape.

---

## 2. TanStack Query — the real gaps

Installed, provider mounted, `useQuery` used in seven feature files. Three problems, in
order of severity.

### 2.1 Refetch-on-refocus and refetch-on-reconnect do not work

This is the behaviour you named explicitly, and on React Native it is **off by default** —
TanStack Query's focus and online managers are written against browser events that do not
exist here. Right now the app never refetches on app resume or network recovery.

```ts
// src/api/query-client.ts  (new)
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);

AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});
```

```bash
npx expo install @react-native-community/netinfo
```

Then import `queryClient` in `_layout.tsx` instead of constructing it inline. Today it is
`new QueryClient()` with no options at all, which means a 0ms `staleTime` — every screen
mount refires its query.

Per-resource `staleTime` overrides worth setting: the task library is a shared read-only
catalog and can sit at 5–10 minutes; session history and routines should stay short.

### 2.2 No hooks layer — and one cache-key bug already

`api/query-keys.ts` is a good factory, but it is bypassed in at least one place:

```ts
// features/home/home-screen.tsx:19
useQuery({ queryKey: ['sessions'], queryFn: listSessions });
```

`queryKeys.sessions` is also `['sessions']`, so this happens to collide correctly today —
but it is a literal, not a reference, and the next key that drifts will silently split the
cache into two entries that never share a fetch. Home and History would each hit the network
for the same list.

Fix structurally: **one hooks file per resource**, and let nothing outside it call
`useQuery` directly.

```
src/api/
  client.ts  query-client.ts  query-keys.ts
  tasks.ts            # transport (unchanged)
  tasks.queries.ts    # useTasks, useTask, useInfiniteTasks
  routines.ts  routines.queries.ts
  sessions.ts  sessions.queries.ts
  recordings.ts  recordings.queries.ts
  coach.ts  coach.queries.ts
  auth.ts  auth.queries.ts
```

```ts
// src/api/tasks.queries.ts
export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: () => listTasks(filters),
    staleTime: 10 * 60_000,
  });
}
```

Feature components then read `const { data, isPending, isError } = useTasks(filters)` and
never see a query key. This is the single change that keeps the cache coherent as the app
grows.

### 2.3 Pagination and mutations are missing

Every list in the wireframes pages — Library ("Load more"), Routines, History ("Load older
sessions") — and the backend paginates all three. `library-list.tsx` currently calls
`listTasks()` once and renders `data.data`, so there is no second page.

Use `useInfiniteQuery` with `getNextPageParam`, and drive it from `FlatList`'s
`onEndReached`. Wireframe 03 draws an explicit "Load more" button rather than infinite
scroll — keep that; it maps cleanly onto `fetchNextPage` and is kinder on a paginated
backend.

There are **no mutations anywhere yet**. When you add them, four rules matter more than the
code:

- **Finish Session** is the one write that matters. On success, invalidate
  `queryKeys.sessions` _and_ the home summary. Do not optimistically update — if the write
  fails the user must still be holding their numbers (wireframe 07b).
- **Routine reorder** is the one place optimistic updates earn their keep. The wireframe
  already specifies the rollback state ("Order not saved… the list is back to the last saved
  order"), which is exactly `onError` restoring the snapshot.
- **AI Instant Create** persists server-side on success — invalidate routines. **Draft &
  Review** writes nothing until confirmed; the draft must not enter the query cache as a
  routine, or it will render in lists before it exists. Hold it in component state.
- **Recording upload** needs progress, which `fetch` cannot report. Use
  `expo-file-system`'s upload task (already a dependency) for the progress bar in wireframe
  09b, and treat the mutation as the wrapper around it.

### 2.4 Optional: offline persistence

`@tanstack/query-async-storage-persister` + `persistQueryClient` with MMKV as the backing
store would make the library and routines readable offline — the "You're offline. Showing
the tasks loaded earlier" state in wireframe 03b. Worth doing after §3 lands, since it
shares the MMKV instance.

---

## 3. Zustand — correct scoping, one data-loss bug

Both stores are well-judged. `features/auth/session-store.ts` caches the last-known user in
SecureStore and reconciles against `getSession()`, with a deliberate fallback to the cached
user when the network is unreachable. `features/session/session-store.ts` holds the active
practice session locally and carries a comment explaining why. That is exactly the
server-state/client-state split you described.

### 3.1 The active session is not persisted

If the app is backgrounded and killed mid-practice — a plausible 45 minutes with the screen
on — every task minute and tick is gone. Nothing was written server-side, by design, so
there is nothing to recover from.

```bash
npx expo install react-native-mmkv
```

```ts
// src/lib/storage.ts
import { MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

export const storage = new MMKV({ id: 'guitar-coach' });

export const mmkvStorage: StateStorage = {
  setItem: (k, v) => storage.set(k, v),
  getItem: (k) => storage.getString(k) ?? null,
  removeItem: (k) => storage.delete(k),
};
```

```ts
// features/session/session-store.ts
export const useActiveSessionStore = create<ActiveSessionState>()(
  persist((set) => ({/* unchanged */}), {
    name: 'active-session',
    storage: createJSONStorage(() => mmkvStorage),
  }),
);
```

Then on app open, if a persisted session exists, offer to resume or discard it. That is a
new state not in the wireframes — worth adding to the design.

Two caveats: **`react-native-mmkv` does not run in Expo Go** — it needs a dev client, which
you already have (`expo-dev-client` is installed). And it requires the New Architecture,
which RN 0.86 defaults to. _Verify against the SDK 57 docs before installing._

### 3.2 What else belongs in MMKV

- Library filter selections, so returning to the tab keeps the chips (wireframe 03b says
  "Filters and search stay as you set them" on error — same principle across navigation)
- The Routines Active/Archived segment
- Onboarding-seen flag, once there is onboarding

**Keep SecureStore for the auth cache.** MMKV is fast but not a keychain; the cached user
object and anything session-adjacent stays where it is. MMKV supports an encryption key if
you later want a middle tier.

### 3.3 Store placement

Two stores live under `features/`. That is fine while each has one consumer, but the auth
session store is imported by `app/_layout.tsx` and `app/(app)/_layout.tsx` — it is app-wide,
not a feature. Move it to `src/stores/session-store.ts` and leave the practice-session store
in its feature. A `src/stores/` folder with a clear rule ("app-wide client state only")
prevents the slow drift where every feature grows a store.

---

## 4. NativeWind — a real decision, not a default

> **Decided 2026-09-04: adopted.** NativeWind 4 + Tailwind 3, with
> `tailwind.config.ts` generated from `tokens.ts` exactly as this section
> recommended. The "adopt it only if the team writes Tailwind daily" condition was
> overtaken by the design change itself — see `docs/ARCHITECTURE.md`'s decision log.
> The section is kept for its reasoning, not as an open question.

Current styling is `StyleSheet.create` reading `theme/tokens.ts`. It works, it is typed, and
`button.tsx` shows it handling hover, press, focus-ring and disabled states correctly across
platforms.

**What NativeWind v4 buys you:** shared vocabulary with web Tailwind, variant composition
via `cva`, and responsive prefixes that would genuinely help the mobile/web fork in
`app-shell.web.tsx` and `rail.web.tsx`.

**What it costs:** the Organic tokens must be mirrored into `tailwind.config.js` — a second
source of truth unless you generate it from `tokens.ts`; all 17 primitives get rewritten;
Metro and Babel config changes; and Reanimated interop needs care. _Verify NativeWind v4
against RN 0.86 / React 19.2 before committing — this stack is new enough that compatibility
should be confirmed, not assumed._

**My read:** adopt it only if the team writes Tailwind daily on the web side. The token layer
already delivers the consistency Tailwind is usually adopted for, and the primitives are
written. If you do adopt it, **do it now** — at 17 components it is a day's work; at 60 it is
a sprint. Generate `tailwind.config.js` from `tokens.ts` so the tokens stay single-source.

---

## 5. UI libraries — don't

> **Decided 2026-09-04: partly overturned.** Gluestack v5 was adopted for the five
> behaviour-heavy primitives (`button`, `progress`, `checkbox`, `actionsheet`,
> `alert-dialog`); everything else stayed hand-written, which is closer to this
> section's advice than to a wholesale kit adoption. `@gorhom/bottom-sheet` is still
> installed per the recommendation below, though `sheet.tsx` now uses Actionsheet.
> Drag-reorder remains unresolved; Move up / Move down shipped as suggested.

You listed Tamagui and Gluestack. Both are good. Neither fits here, for the same reason as
before: Organic is prescriptive down to hover tints and focus rings, and you have already
built the primitives that implement it. Adopting a kit now means deleting working code, then
writing theme configuration until the kit looks like what you deleted.

Where a dependency is still right: `@gorhom/bottom-sheet` (installed — good, it is the one
genuinely hard primitive) and, eventually, drag-reorder.

**Two loose ends in `package.json`:**

- **`@expo/ui` is installed and unused.** It gives real SwiftUI/Jetpack Compose controls —
  attractive for the segmented control — but it cannot be themed to Organic and has no web
  support. Either use it deliberately for a few native-feeling controls and accept they look
  native, or remove it.
- **`expo-glass-effect`, `expo-symbols`, `expo-image`, `expo-device`** appear to be starter
  leftovers. Audit and drop what is unused; each one is install size and upgrade surface.

**Drag-reorder is still unresolved.** Reanimated 4.5.1 and Gesture Handler 2.32 are in place,
so the capability exists. `react-native-draggable-flatlist` has known friction with
Reanimated 4 — build Move up / Move down first (it is the accessible path in wireframe 06 and
needs no library), then spike drag separately against Reanimated 4's own APIs.

---

## 6. Three correctness issues found while reading

> **All three closed.** The active session moved under the auth gate
> (`src/app/(app)/session/active.tsx`), `error-boundary-fallback.tsx` is exported as
> `ErrorBoundary` at both the root and `(app)` layouts, and the toast host exists as
> `src/stores/toast-store.ts` + `src/components/toast-host.tsx`, mounted in the root
> layout. Kept as a record.

Unrelated to your three questions, but they will bite.

**The active session screen is outside the auth gate.** `app/session/active.tsx` sits at the
root stack; the redirect lives in `app/(app)/_layout.tsx`. A deep link to `/session/active`
renders unauthenticated. Either move it under `(app)` as a modal route or duplicate the
guard.

**There is no error boundary.** A throw in any screen unmounts the tree to a blank view. Add
Expo Router's `ErrorBoundary` export at the root layout, and a per-group one under `(app)`.

**There is no toast host.** `components/ui/toast.tsx` exists as a component, but nothing
mounts it globally — the success states throughout the wireframes ("Routine saved", "Added to
Fingerstyle focus", "Session saved") have nowhere to render. Add a provider in the root
layout, or a small Zustand store plus a host rendered above the navigator.

---

## 7. Proposed order of work

1. **Wire TanStack Query properly** (§2.1) — `query-client.ts` with defaults, focus and
   online managers, NetInfo. Half a day, immediately visible.
2. **OpenAPI codegen** (§1) — backend Swagger, `api:types` script, re-point `src/types/`.
   Do it before the API surface grows.
3. **Hooks layer** (§2.2) — one `*.queries.ts` per resource; move every `useQuery` out of
   feature components. Fix the `['sessions']` literal.
4. **Persist the active session** (§3.1) — MMKV + `persist`, plus the resume-or-discard state.
5. **Infinite queries** (§2.3) for the three paginated lists.
6. **Mutations**, following the four rules in §2.3.
7. **Correctness fixes** (§6) — auth gate, error boundary, toast host.
8. **Decide NativeWind** (§4) — before the component count grows.

Steps 1–3 are the ones that determine whether this scales. Everything after is ordinary
feature work.

---

## Constraints that must survive any restructure

Carried forward from the verified API review — none of these are visible in the code or the
wireframe pixels, and all of them are easy to break during a refactor:

- **Starting practice creates nothing.** The session is written once, on Finish.
- **Session time is optional.** No total-elapsed field exists; per-task minutes and the
  completed flag are both optional. Every total is a client-side sum, and the UI must read
  correctly when minutes are absent.
- **Finished sessions cannot be edited.** No update endpoint.
- **Tasks are read-only** for ordinary users.
- **The two AI modes are separate endpoints.** Draft & Review writes nothing until confirmed
  and expires after 15 minutes; Instant Create persists on success.
- **Lists are paginated** — tasks, routines, sessions.
- **Recordings:** MP3, WAV, M4A/MP4, OGG, WebM; 50 MB cap; playback via a temporary URL
  requested per play, so the expired-link state is real.
- **No analytics endpoint.** Home's "this week" is derived client-side from the session list.
