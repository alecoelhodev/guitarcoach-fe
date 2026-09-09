import { renderHook, waitFor } from '@testing-library/react-native';

import { signOut } from '@/api/auth';
import { useSignOut } from '@/api/auth.queries';
import { purgePersistedCache } from '@/api/persist';
import { queryKeys } from '@/api/query-keys';
import { useSessionStore } from '@/stores/session-store';
import { makeUser } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';
import { resetStores } from '@/test/reset-stores';

jest.mock('@/api/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/api/persist', () => ({ purgePersistedCache: jest.fn() }));

const signOutMock = signOut as jest.MockedFunction<typeof signOut>;
const purgeMock = purgePersistedCache as jest.MockedFunction<typeof purgePersistedCache>;

async function setup() {
  const { queryClient, wrapper } = withQueryClient();
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

  it('still signs the user out locally when the request fails', async () => {
    // The whole reason the hook uses `onSettled` rather than `onSuccess`: a failed request
    // must not strand someone in a session they asked to leave.
    signOutMock.mockRejectedValue(new Error('offline'));

    const { result, queryClient } = await setup();
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
  });

  it('purges the on-disk snapshot too, which clearing the client does not touch', async () => {
    signOutMock.mockRejectedValue(new Error('offline'));

    const { result } = await setup();
    result.current.mutate();

    await waitFor(() => expect(purgeMock).toHaveBeenCalledTimes(1));
  });
});
