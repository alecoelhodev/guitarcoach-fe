# API integration conventions

How a screen talks to the backend. Follow this and the cache stays coherent, errors read the
same everywhere, and nothing needs re-deciding per screen.

The contract itself — regenerating `src/types/api.d.ts` from the backend's OpenAPI schema —
is a separate runbook: [`api-contract-workflow.md`](api-contract-workflow.md).

## The two-file rule

Every resource is a pair, and nothing else is added:

| File                            | Holds                                                         |
| ------------------------------- | ------------------------------------------------------------- |
| `src/api/<resource>.ts`         | Plain async transport. Calls `request()`. No React, no cache. |
| `src/api/<resource>.queries.ts` | Hooks. `useQuery` / `useInfiniteQuery` / `useMutation`.       |

**Feature components import only from `*.queries.ts`.** A `useQuery` with an inline key in a
feature file splits the cache: two components fetch the same data under two keys and neither
sees the other's result.

Types come from `src/types/*.ts`, which re-export the generated `api.d.ts`. Never hand-write
a parallel shape — it drifts silently.

## Query keys

All keys live in `src/api/query-keys.ts`. Two rules:

1. **Every key carries a kind segment** — `list`, `detail`, or `summary` — after its root.
   Without one, a `useQuery` and a `useInfiniteQuery` over the same filters produce the same
   key and TanStack throws on the mismatched query type. This is not hypothetical: `sessions`
   and `sessionsSummary` were one argument away from colliding.
2. **Invalidate with the root, never a literal.** `queryKeys.sessionsRoot`, not
   `['sessions']`. Roots are the first segment, so a root invalidation matches every list and
   detail beneath it.

```ts
tasksRoot: ['tasks'] as const,
tasks: (query?) => ['tasks', 'list', query] as const,
task:  (id)     => ['tasks', 'detail', id] as const,
```

## Freshness

Defaults live in `src/api/query-client.ts`: `staleTime` 30 s, `gcTime` 5 min, refetch on focus
and on reconnect (both wired manually — React Native does not get them for free).

Override per resource by how fast the data actually changes:

| Data                             | `staleTime`  | Why                                  |
| -------------------------------- | ------------ | ------------------------------------ |
| Task library (read-only catalog) | 10 min       | Shared, admin-edited, rarely changes |
| Sessions, history                | 15 s         | The user is writing it right now     |
| Routines, recordings             | 30 s default | Changes on user action, not clock    |

## Retries

`retry` is `shouldRetry` from `src/api/errors.ts`. A 4xx is the server stating a fact — the id
is gone, access is denied — so retrying only delays the error state by two round trips. Only
offline and 5xx are retried. Mutations never retry.

## Loading, error and empty states

Do not hand-roll the `isPending ? … : isError ? …` ladder. Use `QueryState`:

```tsx
const query = useTasks();
const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];

<QueryState
  query={query}
  errorTitle="Couldn't load the library"
  isEmpty={tasks.length === 0}
  empty={<EmptyState title="No tasks yet" />}
>
  {() => <FlatList data={tasks} … />}
</QueryState>
```

`children` receives the resolved data, so detail screens keep a non-optional type:

```tsx
<QueryState query={query} errorTitle="Couldn't load this task">
  {(task) => <ThemedText type="h3">{task.title}</ThemedText>}
</QueryState>
```

**All error copy comes from `describeError`.** `errorTitle` is only the fallback for an
unrecognised failure — a known cause names itself, because someone with no connection needs
to read "No connection", not "Couldn't load the library". Screens that combine two queries or
return early (`routine-detail`, `session-detail`) call `describeError` directly rather than
forcing a two-query case through a one-query component.

Never render a raw `error.message` from a non-`ApiError`: `describeError` returns a generic
line for those so internal detail (hostnames, stack text) cannot reach the screen.

## Mutations

Four rules, in the order they matter:

- **Invalidate on success, with a root key.** `useCreateSession` invalidates
  `queryKeys.sessionsRoot`, which covers both the history list and the home summary.
- **Optimistic updates need a rollback, and most writes do not need one.**
  `useReorderRoutineTasks` is the one place it earns its keep: `onMutate` cancels in-flight
  queries, snapshots, and writes; `onError` restores the snapshot; `onSettled` invalidates.
  Finish Session deliberately has none — if the write fails the user must still be holding
  their numbers.
- **Do not put unconfirmed data in the cache.** The AI Coach's Draft & Review persists
  nothing until confirmed; the draft lives in component state, or it renders in routine lists
  before it exists. Instant Create does persist, so it invalidates.
- **Practice sessions are write-once.** There is no update endpoint. The session is created
  on Finish; in-progress state lives in `src/features/session/session-store.ts`.

## Offline

`src/api/persist.ts` persists the query cache to MMKV, restored via
`PersistQueryClientProvider`, so lists render from the last snapshot when the app opens
offline.

- Bump `CACHE_BUSTER` whenever a cached response shape changes — restoring an old shape into
  a new screen crashes it. A backend field rename is exactly this case.
- `maxAge` is 24 h. Writes are throttled by ~1 s inside the persister, so a snapshot taken
  immediately after a mutation may not be on disk yet — this matters in tests, not at runtime.
- **Purge on sign-out and on 401.** `queryClient.clear()` empties memory only; the snapshot
  on disk survives it. `purgePersistedCache()` handles the rest, and both are already wired
  into `useSignOut` and the unauthorized handler. If you add another sign-out path, it must
  do both, or the next person to open the app offline reads the previous user's data.
- MMKV here is unencrypted, so the persisted cache holds practice content only. No credential
  is involved — auth is an httpOnly cookie and never enters the query cache.

## Two deliberate exceptions

Both are correct; do not "fix" them into hooks.

- **Auth is imperative.** Sign-in/sign-up are one-shot form submits driven by
  `src/api/auth.ts` directly, with `src/stores/session-store.ts` holding status. Only
  `useSignOut` is a hook, because it owns cache teardown. `auth-form.tsx` also keeps its own
  401 copy ("Email or password is incorrect") — a 401 there means bad credentials, not an
  expired session, which `describeError` cannot tell from the status alone.
- **Recording download URLs are never cached.** `recording-row.tsx` calls
  `getRecordingDownloadUrl` per play because the URL is short-lived. Caching it serves expired
  URLs.

## Testing

`src/api/__tests__/routines.queries.test.tsx` is the template for hook tests.

- RNTL 14's `renderHook` is **async** — `await` it, or `result` is undefined.
- Give the test `QueryClient` `mutations: { gcTime: 0 }`, or a settled mutation keeps a
  five-minute collection timer and Jest will not exit. Use `gcTime: Infinity` for queries so
  seeded `setQueryData` survives the test.
- Assert optimistic writes _inside_ the mocked transport — that proves the cache was updated
  before the request went out, not merely after it returned.
