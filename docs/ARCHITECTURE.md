# Architecture

Guitar Coach is an Expo-based mobile (+ web) app for guided guitar practice: users follow
routines made of tasks, run timed practice sessions, review history, and can ask an AI coach
to draft or instantly create a practice routine.

## Tech stack

- **Expo SDK 57.0.15**, React Native 0.86.2, React 19.2.3 — New Architecture is on by default
  at this SDK version, no opt-out.
- **Expo Router** for file-based, typed routing (`.expo/types/router.d.ts` is generated from
  `src/app/`).
- **TanStack Query v5** for all server-state (fetching, caching, pagination, mutations).
- **Zustand v5** for local/client state (auth session, active practice session, toasts).
- **react-native-mmkv v4** for fast key-value storage, used as the persistence layer under
  Zustand's `persist` middleware.
- **react-hook-form + zod** for form state and validation.
- **react-native-web** so the same app runs in a browser, with `.web.tsx`/`.web.ts` platform
  files where native and web behavior genuinely diverge (nav chrome, storage).

## Project structure

```
src/
├── api/         transport functions (api/*.ts) + paired TanStack Query hooks (*.queries.ts)
├── app/         Expo Router routes (screens + layouts)
├── components/  shared components: nav/ (chrome), ui/ (design-system primitives), loose files
├── features/    screen-level feature modules, one folder per domain
├── hooks/       small cross-cutting hooks (e.g. color scheme)
├── lib/         framework-agnostic helpers (storage, date/duration formatting, validation)
├── stores/      app-wide Zustand stores (session, toast)
├── theme/       design tokens and typography
└── types/       shared TypeScript types per domain
```

Each `features/<domain>/` folder holds the screen component(s) and any domain-local
sub-components for that feature (e.g. `features/routines/routine-detail.tsx`,
`routine-card.tsx`). Route files under `src/app/` are thin — they resolve params and render
the corresponding `features/` component.

## Routing (`src/app/`)

Routing is structured around a two-level gate plus a chrome-wrapping group:

- **`(auth)` vs `(app)`** — the top-level session gate. `(auth)/_layout.tsx` redirects to `/`
  when already authenticated; `(app)/_layout.tsx` redirects to `/(auth)/sign-in` when
  unauthenticated. Both read `status` from `src/stores/session-store.ts`.
- **`(app)/(main)`** — a nested pathless group whose layout wraps its screens in `AppShell`
  (the tab bar / web rail chrome) and a headerless `Stack` covering `(tabs)`,
  `routines/[id]`, `library/[id]`, `history/index`, `history/[id]`, and `coach`.
- **`(app)/session/active`** — the active practice screen is registered as a sibling of
  `(main)` inside `(app)/_layout.tsx`, presented as a `fullScreenModal`. It's deliberately
  *outside* `(main)` so it stays auth-gated (fixing an earlier bug where this route bypassed
  auth entirely by living at the app root) while staying free of the tab bar/rail chrome that
  `(main)` applies — a full-screen practice UI shouldn't have nav chrome around it.
- **`(tabs)`** — the four bottom-tab screens (home, library, routines, profile), with a
  `.web.tsx` variant of the tabs layout that renders a left rail instead of a bottom bar.

## State management

Three Zustand stores, split by lifetime and ownership:

- **`src/stores/session-store.ts`** — auth/session status (`'loading' | 'authenticated' |
  'unauthenticated'`) plus the current `user`. The real session lives server-side in an
  httpOnly cookie; this store only caches the last-known `user` in `expo-secure-store` so the
  UI can render instantly on boot. `hydrate()` reads that cache first, then calls
  `getSession()` to reconcile: on success it updates the cache/status, on network failure it
  falls back to `authenticated` if a cached user exists, otherwise `unauthenticated`.
- **`src/features/session/session-store.ts`** — the in-progress practice session (routine id,
  title, per-task target/actual duration and completion). Persisted via Zustand's `persist`
  middleware backed by MMKV, solely so backgrounding or killing the app doesn't lose in-flight
  progress. The actual session record is still written to the server exactly once, on Finish
  — this store never performs that write itself.
- **`src/stores/toast-store.ts`** — a single `{ message, variant } | null`, unpersisted,
  driving the global toast host.

## Data layer — TanStack Query

`src/api/query-client.ts` builds the shared `QueryClient` with real defaults instead of the
library defaults, since React Native doesn't get focus/reconnect refetching for free:

- `defaultOptions.queries`: `staleTime: 30_000`, `gcTime: 300_000`, `retry: 2`,
  `refetchOnWindowFocus: true`, `refetchOnReconnect: true`.
- `defaultOptions.mutations`: `retry: 0`.
- `onlineManager` is wired to `@react-native-community/netinfo` (`state.isConnected`).
- `focusManager` is wired to `AppState`, treating `'active'` as focused — skipped on web,
  where the browser already handles this.

Each resource follows the same two-file pattern:

- **`api/<resource>.ts`** — plain async transport functions (e.g. `listRoutines`,
  `createSession`).
- **`api/<resource>.queries.ts`** — hooks wrapping those functions in `useQuery` /
  `useInfiniteQuery` / `useMutation`, keyed via the centralized factory in
  `src/api/query-keys.ts` (e.g. `queryKeys.routines(filters)`, `queryKeys.routine(id)`).

Feature components only ever import from `*.queries.ts`, never call transport functions or
build query keys directly.

Two representative patterns:

- **Infinite-query pagination** (`useRoutines` in `src/api/routines.queries.ts`) —
  `useInfiniteQuery` with page-based `pageParam` and
  `getNextPageParam: (last) => last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined`.
  List screens (Library, Routines, History) expose this as a "Load more" button rather than
  automatic infinite scroll.
- **Optimistic mutation with rollback** (`useReorderRoutineTasks`) — `onMutate` cancels
  in-flight queries for that key and snapshots + optimistically writes the reordered list via
  `setQueryData`; `onError` restores the snapshot; `onSettled` invalidates to reconcile with
  the server.

Mutations that write session-critical data (e.g. Finish Session) intentionally have no
optimistic update — the user should keep seeing their in-progress numbers on screen until the
write actually succeeds.

## MMKV storage adapter

`src/lib/storage.ts` creates one MMKV instance via `react-native-mmkv`'s `createMMKV({ id:
'guitar-coach' })`, then exposes a thin Zustand `StateStorage` adapter (`setItem`/`getItem`/
`removeItem`) over `storage.set` / `storage.getString` / `storage.remove`, for use with
`persist(..., { storage: createJSONStorage(() => mmkvStorage) })`. `createMMKV` resolves to a
real MMKV store on native and an automatic `localStorage`-backed shim on web — no separate
`.web.ts` file is needed for storage.

## UI system

`src/theme/tokens.ts` holds the app's "Organic" design tokens, ported directly from the
design system's source values rather than approximated: `Colors` (base bg/surface/text/accent
plus 100–900 accent/neutral ramps), `Spacing` (a 1.10x density scale), `Radius`, `Shadow`
(cross-platform shadow + elevation pairs), `Interaction` (hover/pressed/focus/disabled
states), and standalone `MaxContentWidth` / `TabBarInset` constants.

`src/components/ui/` is the primitive component library built directly on these tokens, with
no external UI-kit dependency: `badge`, `button`, `card`, `checklist-row`, `chip`,
`confirm-dialog`, `empty-state`, `error-panel`, `field-label`, `input`, `progress-bar`,
`segmented`, `sheet`, `skeleton`, `stepper`, `toast`, `validation-message`.

## Cross-cutting mechanisms

- **Error boundaries** — `src/components/error-boundary-fallback.tsx` implements Expo
  Router's file-based `ErrorBoundary` convention: a layout can `export { ErrorBoundaryFallback
  as ErrorBoundary }` to render `{ error, retry }` in place of a screen that threw. It's wired
  at the root layout and at `(app)/_layout.tsx`.
- **Toasts** — `src/stores/toast-store.ts` + `src/components/toast-host.tsx`. `ToastHost`
  (mounted once in the root layout) renders nothing while `toast` is null, otherwise shows the
  `Toast` UI component and auto-dismisses after 3 seconds.

## AI Coach flow

`src/features/coach/coach-screen.tsx` offers two modes, backed by `src/api/coach.queries.ts`:

- **Draft & Review** — `useRequestPracticePlan` submits a prompt; if the response is
  `awaiting_confirmation`, a preview card is shown and `useResolvePracticePlan` sends the
  confirm/reject decision. Routines are invalidated (`queryKeys.routines()`/`['routines']`)
  only when the resolved status is `created`, since nothing is persisted server-side until
  confirmed.
- **Instant Create** — `useInstantCreateRoutine` creates a routine directly from one message
  and always invalidates routines on success, since the server persists unconditionally.

## Known gaps / explicitly out of scope

- Recording upload (`uploadRecording` in `src/api/recordings.ts`) has no consuming UI yet —
  no picker screen exists, so it isn't wired into any screen.
- OpenAPI-generated API types/client were not adopted — there's no shared backend repo
  available to generate against.
- Offline persistence is limited to the active-session MMKV cache described above; there's no
  general offline query cache or mutation queue.

## Decision log

- **NativeWind / Tamagui rewrite** — considered and declined. Adopting either would mean
  discarding the 17 working, precisely-themed primitives in `src/components/ui/` for no
  concrete near-term benefit. Worth revisiting only if the team starts writing Tailwind daily
  on the web target.
