import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

import { storage } from '@/lib/storage';

const CACHE_KEY = 'guitar-coach.query-cache';

/**
 * MMKV is synchronous, so this uses the sync persister rather than the async-storage one —
 * no Promise wrapping around calls that never yield.
 */
export const queryPersister = createSyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: (key) => storage.getString(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.remove(key),
  },
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
