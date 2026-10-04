import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  type DehydratedState,
  type DehydrateOptions,
  defaultShouldDehydrateQuery,
  type InfiniteData,
  type Query,
} from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

import { queryKeys } from '@/api/query-keys';
import { storage } from '@/lib/storage';

const CACHE_KEY = 'guitar-coach.query-cache';

/**
 * AsyncStorage is asynchronous, so this uses the async persister rather than the sync one.
 * `PersistQueryClientProvider` in `src/app/_layout.tsx` already waits out the restore, so
 * the wait costs nothing at the call site.
 */
export const queryPersister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage,
  serialize: (client) => JSON.stringify(firstPagesOnly(client)),
});

type DehydratedQuery = DehydratedState['queries'][number];

/**
 * An infinite list restores fine from its first page and refetches the rest on demand, so
 * every page past it is disk and parse time on each cold start for nothing.
 */
function firstPagesOnly(client: PersistedClient): PersistedClient {
  return {
    ...client,
    clientState: { ...client.clientState, queries: client.clientState.queries.map(firstPage) },
  };
}

// Builds new objects: the dehydrated state shares `data` with the live cache.
function firstPage(query: DehydratedQuery): DehydratedQuery {
  const data = query.state.data as InfiniteData<unknown> | undefined;
  if (query.queryType !== 'infinite' || !data) return query;
  return {
    ...query,
    state: {
      ...query.state,
      data: { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
    },
  };
}

function isSessionDetail({ queryKey }: Query) {
  const [root, kind] = queryKeys.session('');
  return queryKey.length === 3 && queryKey[0] === root && queryKey[1] === kind;
}

/**
 * Passed to `PersistQueryClientProvider`. A session detail carries free-text practice notes,
 * which stay off the disk. Mutations never persist: a paused write replayed on the next
 * launch could land under a different account.
 */
export const dehydrateOptions: DehydrateOptions = {
  shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) && !isSessionDetail(query),
  shouldDehydrateMutation: () => false,
};

/** Bump when a cached response shape changes; restoring old shapes into new screens crashes. */
export const CACHE_BUSTER = 'v1';

export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * `queryClient.clear()` only empties memory — the snapshot on disk survives it. Both have
 * to go on sign-out, or the next person to open the app offline reads the previous user's
 * routines and practice history straight off the device.
 */
export function purgePersistedCache() {
  return queryPersister.removeClient();
}
