import { dehydrate, type InfiniteData } from '@tanstack/react-query';

import {
  CACHE_MAX_AGE_MS,
  dehydrateOptions,
  purgePersistedCache,
  queryPersister,
} from '@/api/persist';
import { queryKeys } from '@/api/query-keys';
import { storage } from '@/lib/storage';
import { makeTestQueryClient } from '@/test/query-client';

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

  // P9: every page of every infinite list used to go to disk on each write. This is the
  // suite's only `persistClient` call, so the one-second throttle never delays it.
  it('writes only the first page of an infinite query', async () => {
    const queryClient = makeTestQueryClient();
    await queryClient.fetchInfiniteQuery({
      queryKey: queryKeys.tasks(),
      queryFn: ({ pageParam }) => Promise.resolve([`page-${pageParam}`]),
      initialPageParam: 1,
      getNextPageParam: (_last, all) => all.length + 1,
      pages: 3,
    });
    const livePages = () =>
      queryClient.getQueryData<InfiniteData<string[]>>(queryKeys.tasks())?.pages;
    expect(livePages()).toHaveLength(3);

    await queryPersister.persistClient({
      timestamp: 1,
      buster: 'v1',
      clientState: dehydrate(queryClient, dehydrateOptions),
    });

    const restored = await queryPersister.restoreClient();
    expect(restored?.clientState.queries[0].state.data).toEqual({
      pages: [['page-1']],
      pageParams: [1],
    });
    // Only the copy on disk is trimmed; the live cache keeps what the screen scrolled to.
    expect(livePages()).toHaveLength(3);
  });
});

describe('dehydrateOptions', () => {
  // S3: a session detail carries free-text practice notes.
  it('keeps practice-session details off the disk, but not their recordings', () => {
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(queryKeys.session('s1'), { id: 's1', notes: 'PRIVATE' });
    queryClient.setQueryData(queryKeys.recordings('s1'), []);
    queryClient.setQueryData(queryKeys.routine('r1'), { id: 'r1' });

    const { queries } = dehydrate(queryClient, dehydrateOptions);

    expect(queries.map((query) => query.queryKey)).toEqual([
      queryKeys.recordings('s1'),
      queryKeys.routine('r1'),
    ]);
  });

  it('still drops queries that never succeeded, as the default does', async () => {
    const queryClient = makeTestQueryClient();
    await queryClient
      .fetchQuery({
        queryKey: queryKeys.task('t1'),
        queryFn: () => Promise.reject(new Error('boom')),
      })
      .catch(() => undefined);

    expect(dehydrate(queryClient, dehydrateOptions).queries).toEqual([]);
  });

  // P9: a paused write replayed on the next launch could land under another account.
  it('never persists a mutation, even a paused one', () => {
    const queryClient = makeTestQueryClient();
    const mutation = queryClient.getMutationCache().build(queryClient, { mutationKey: ['m'] });
    mutation.state.isPaused = true;

    expect(dehydrate(queryClient, dehydrateOptions).mutations).toEqual([]);
    // Guards the assertion above: the library default would have kept this one.
    expect(dehydrate(queryClient).mutations).toHaveLength(1);
  });
});
