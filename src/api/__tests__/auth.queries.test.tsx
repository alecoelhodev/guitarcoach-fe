import { onlineManager, QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { signOut } from '@/api/auth';
import { useSignOut } from '@/api/auth.queries';
import { purgePersistedCache } from '@/api/persist';
import { queryClient as appQueryClient } from '@/api/query-client';
import { queryKeys } from '@/api/query-keys';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useSessionStore } from '@/stores/session-store';
import { makeUser } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';
import { resetStores } from '@/test/reset-stores';

jest.mock('@/api/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/api/persist', () => ({ purgePersistedCache: jest.fn() }));

/** Long enough for the hook's two retries (500ms then 1000ms) plus slack. */
const RETRY_WINDOW_MS = 5000;

const signOutMock = signOut as jest.MockedFunction<typeof signOut>;
const purgeMock = purgePersistedCache as jest.MockedFunction<typeof purgePersistedCache>;

async function setup(client?: QueryClient) {
  const { queryClient, wrapper } = withQueryClient(client);
  queryClient.setQueryData(queryKeys.me, makeUser());

  const { result } = await renderHook(() => useSignOut(), { wrapper });
  return { result, queryClient };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await resetStores();
  await useSessionStore.getState().setUser(makeUser());
});

describe('useSignOut', () => {
  it('clears the session and both caches on success', async () => {
    signOutMock.mockResolvedValue(undefined as never);

    const { result, queryClient } = await setup();
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
    expect(purgeMock).toHaveBeenCalledTimes(1);
  });

  // QA-01. Sign-out cleared three things and forgot the fourth; `clearLocalSession` is what
  // keeps this path and the 401 path from forgetting different ones.
  it('discards an in-progress practice session, not just the caches', async () => {
    signOutMock.mockResolvedValue(undefined as never);
    useActiveSessionStore.getState().start({
      userId: 'user-1',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
    });

    const { result } = await setup();
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useActiveSessionStore.getState().tasks).toEqual([]);
  });

  it('still signs the user out locally when the request fails', async () => {
    // The whole reason the hook uses `onSettled` rather than `onSuccess`: a failed request
    // must not strand someone in a session they asked to leave.
    signOutMock.mockRejectedValue(new Error('offline'));

    const { result, queryClient } = await setup();
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: RETRY_WINDOW_MS });
    expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
  });

  it('purges the on-disk snapshot too, which clearing the client does not touch', async () => {
    signOutMock.mockRejectedValue(new Error('offline'));

    const { result } = await setup();
    result.current.mutate();

    await waitFor(() => expect(purgeMock).toHaveBeenCalledTimes(1), {
      timeout: RETRY_WINDOW_MS,
    });
  });

  // Clearing locally is not signing out: the cookie is in the platform's own store, so a
  // request that never lands leaves the session alive and the next cold start signs the
  // account back in. Worth more than one attempt.
  it('retries before giving up, unlike every other mutation', async () => {
    signOutMock.mockRejectedValue(new Error('offline'));

    const { result } = await setup();
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: RETRY_WINDOW_MS });
    expect(signOutMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry a sign-out that worked', async () => {
    signOutMock.mockResolvedValue(undefined as never);

    const { result } = await setup();
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  // P1: under TanStack's default `networkMode: 'online'` this mutation paused offline, so
  // `onSettled` never ran and the user stayed signed in on the device they asked to leave.
  describe('offline', () => {
    afterEach(() => onlineManager.setOnline(true));

    it('still clears local state with the app client defaults', async () => {
      onlineManager.setOnline(false);
      signOutMock.mockRejectedValue(new Error('No connection'));
      const client = new QueryClient({
        defaultOptions: {
          mutations: { ...appQueryClient.getDefaultOptions().mutations, gcTime: 0 },
        },
      });

      const { result } = await setup(client);
      result.current.mutate();

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: RETRY_WINDOW_MS,
      });
      expect(result.current.isPaused).toBe(false);
      expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
      expect(client.getQueryData(queryKeys.me)).toBeUndefined();
      expect(purgeMock).toHaveBeenCalledTimes(1);
    });
  });
});
