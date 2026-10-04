import { getSession } from '@/api/auth';
import { purgePersistedCache } from '@/api/persist';
import { queryKeys } from '@/api/query-keys';
import { storage } from '@/lib/storage';
import { clearLocalSession } from '@/stores/clear-local-session';
import { useSessionStore } from '@/stores/session-store';
import { makeUser } from '@/test/fixtures';
import { makeTestQueryClient } from '@/test/query-client';
import { resetStores } from '@/test/reset-stores';

jest.mock('@/api/auth', () => ({ getSession: jest.fn() }));

const getSessionMock = getSession as jest.MockedFunction<typeof getSession>;

const user = makeUser();

const CACHE_KEY = 'guitar-coach.cached-user';
const QUERY_CACHE_KEY = 'guitar-coach.query-cache';

let client = makeTestQueryClient();

/** What `_layout.tsx` passes: the shared teardown, minus the owner-stamped practice session. */
const forgetAccount = () => clearLocalSession(client, { keepActiveSession: true });

beforeEach(async () => {
  jest.clearAllMocks();
  await resetStores();
  client = makeTestQueryClient();
});

afterEach(() => purgePersistedCache());

describe('hydrate', () => {
  it('authenticates and caches the user the server returns', async () => {
    getSessionMock.mockResolvedValue({ user });

    await useSessionStore.getState().hydrate(forgetAccount);

    expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', user });
    expect(await storage.getItem(CACHE_KEY)).toBe(JSON.stringify(user));
  });

  it('drops the cached user when the server says there is no session', async () => {
    await storage.setItem(CACHE_KEY, JSON.stringify(user));
    getSessionMock.mockResolvedValue(null);

    await useSessionStore.getState().hydrate(forgetAccount);

    expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(await storage.getItem(CACHE_KEY)).toBeNull();
  });

  // S2: the 24h query cache is not keyed by user, so dropping only the cached user left the
  // previous account's routines and history for whoever signed in next.
  it("forgets the previous account's query cache, in memory and on disk", async () => {
    await storage.setItem(CACHE_KEY, JSON.stringify(user));
    await storage.setItem(QUERY_CACHE_KEY, '{"clientState":{"queries":[]}}');
    client.setQueryData(queryKeys.me, user);
    getSessionMock.mockResolvedValue(null);

    await useSessionStore.getState().hydrate(forgetAccount);

    expect(client.getQueryData(queryKeys.me)).toBeUndefined();
    expect(await storage.getItem(QUERY_CACHE_KEY)).toBeNull();
  });

  it('settles unauthenticated even when the teardown fails', async () => {
    getSessionMock.mockResolvedValue(null);
    const failing = jest.fn().mockRejectedValue(new Error('disk full'));

    await expect(useSessionStore.getState().hydrate(failing)).rejects.toThrow('disk full');

    expect(useSessionStore.getState().status).toBe('unauthenticated');
  });

  it('falls back to the cached user when the network is unreachable', async () => {
    await storage.setItem(CACHE_KEY, JSON.stringify(user));
    getSessionMock.mockRejectedValue(new Error('No connection'));

    await useSessionStore.getState().hydrate(forgetAccount);

    // Deliberate: an unreachable API must not bounce a signed-in user to sign-in.
    expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', user });
  });

  it('stays unauthenticated when the network fails and nothing is cached', async () => {
    getSessionMock.mockRejectedValue(new Error('No connection'));

    await useSessionStore.getState().hydrate(forgetAccount);

    expect(useSessionStore.getState().status).toBe('unauthenticated');
  });

  // P2: the read and the parse sat outside the `try`, so a corrupt value rejected `hydrate`
  // with the status still 'loading', and the splash waits on that status forever.
  describe('with a corrupt cached user', () => {
    beforeEach(() => storage.setItem(CACHE_KEY, '{not json'));

    it('still authenticates when the server has a session', async () => {
      getSessionMock.mockResolvedValue({ user });

      await useSessionStore.getState().hydrate(forgetAccount);

      expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', user });
      expect(await storage.getItem(CACHE_KEY)).toBe(JSON.stringify(user));
    });

    it('settles unauthenticated when the network is unreachable', async () => {
      getSessionMock.mockRejectedValue(new Error('No connection'));

      await useSessionStore.getState().hydrate(forgetAccount);

      expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    });
  });
});

describe('clear', () => {
  it('forgets the cached user', async () => {
    await useSessionStore.getState().setUser(user);
    expect(await storage.getItem(CACHE_KEY)).not.toBeNull();

    await useSessionStore.getState().clear();

    expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(await storage.getItem(CACHE_KEY)).toBeNull();
  });
});
