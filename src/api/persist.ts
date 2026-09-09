import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

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
});

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
