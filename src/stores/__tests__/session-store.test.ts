import { getSession } from '@/api/auth';
import { storage } from '@/lib/storage';
import { useSessionStore } from '@/stores/session-store';
import { makeUser } from '@/test/fixtures';
import { resetStores } from '@/test/reset-stores';

jest.mock('@/api/auth', () => ({ getSession: jest.fn() }));

const getSessionMock = getSession as jest.MockedFunction<typeof getSession>;

const user = makeUser();

const CACHE_KEY = 'guitar-coach.cached-user';

beforeEach(async () => {
  jest.clearAllMocks();
  await resetStores();
});

describe('hydrate', () => {
  it('authenticates and caches the user the server returns', async () => {
    getSessionMock.mockResolvedValue({ user });

    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', user });
    expect(await storage.getItem(CACHE_KEY)).toBe(JSON.stringify(user));
  });

  it('drops the cached user when the server says there is no session', async () => {
    await storage.setItem(CACHE_KEY, JSON.stringify(user));
    getSessionMock.mockResolvedValue(null);

    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(await storage.getItem(CACHE_KEY)).toBeNull();
  });

  it('falls back to the cached user when the network is unreachable', async () => {
    await storage.setItem(CACHE_KEY, JSON.stringify(user));
    getSessionMock.mockRejectedValue(new Error('No connection'));

    await useSessionStore.getState().hydrate();

    // Deliberate: an unreachable API must not bounce a signed-in user to sign-in.
    expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', user });
  });

  it('stays unauthenticated when the network fails and nothing is cached', async () => {
    getSessionMock.mockRejectedValue(new Error('No connection'));

    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState().status).toBe('unauthenticated');
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
