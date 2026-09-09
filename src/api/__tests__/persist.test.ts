import { CACHE_MAX_AGE_MS, purgePersistedCache, queryPersister } from '@/api/persist';
import { storage } from '@/lib/storage';

const CACHE_KEY = 'guitar-coach.query-cache';

const client = {
  timestamp: 1,
  buster: 'v1',
  clientState: { mutations: [], queries: [] },
};

/**
 * Writes go through `persistClient`, which the library throttles by a second — these seed
 * storage directly so the adapter's read and remove paths are what is under test.
 */
function seed() {
  return storage.setItem(CACHE_KEY, JSON.stringify(client));
}

describe('queryPersister', () => {
  afterEach(() => purgePersistedCache());

  it('reads the snapshot back off storage', async () => {
    await seed();

    expect(await queryPersister.restoreClient()).toEqual(client);
  });

  /**
   * `queryClient.clear()` only empties memory. If the snapshot survives sign-out, the next
   * person to open the app offline reads the previous user's routines and history.
   */
  it('leaves nothing on disk after a purge', async () => {
    await seed();
    await purgePersistedCache();

    expect(await storage.getItem(CACHE_KEY)).toBeNull();
    expect(await queryPersister.restoreClient()).toBeUndefined();
  });

  it('expires after a day so a stale snapshot cannot outlive the session', () => {
    expect(CACHE_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
