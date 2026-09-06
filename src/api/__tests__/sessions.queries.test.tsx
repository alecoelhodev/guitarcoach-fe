import { renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '@/api/query-keys';
import { createSession, getSession, listSessions } from '@/api/sessions';
import {
  useCreateSession,
  useSession,
  useSessions,
  useSessionsSummary,
} from '@/api/sessions.queries';
import { makePage, makeSession } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';

jest.mock('@/api/sessions', () => ({
  createSession: jest.fn(),
  listSessions: jest.fn(),
  getSession: jest.fn(),
}));

const listMock = listSessions as jest.MockedFunction<typeof listSessions>;
const createMock = createSession as jest.MockedFunction<typeof createSession>;
const getMock = getSession as jest.MockedFunction<typeof getSession>;

afterEach(() => jest.resetAllMocks());

describe('useSessions pagination', () => {
  it('offers the next page while one remains', async () => {
    listMock.mockResolvedValue(makePage([makeSession()], { page: 1, totalPages: 3 }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('stops on the last page rather than requesting one past the end', async () => {
    // `page < totalPages` is the boundary: page 3 of 3 must yield undefined, not 4.
    listMock.mockResolvedValue(makePage([makeSession()], { page: 3, totalPages: 3 }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('treats a single empty page as complete', async () => {
    listMock.mockResolvedValue(makePage([], { page: 1, totalPages: 0 }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('requests the following page number when asked for more', async () => {
    listMock
      .mockResolvedValueOnce(makePage([makeSession({ id: 's1' })], { page: 1, totalPages: 2 }))
      .mockResolvedValueOnce(makePage([makeSession({ id: 's2' })], { page: 2, totalPages: 2 }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useSessions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(listMock).toHaveBeenLastCalledWith({ page: 2 });
    expect(result.current.data?.pages.flatMap((page) => page.data).map((s) => s.id)).toEqual([
      's1',
      's2',
    ]);
  });

  it('carries the caller filters into every page request', async () => {
    listMock.mockResolvedValue(makePage([], { page: 1, totalPages: 1 }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useSessions({ limit: 5 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledWith({ limit: 5, page: 1 });
  });
});

describe('useCreateSession', () => {
  it('invalidates every session list once the write lands', async () => {
    const session = makeSession();
    createMock.mockResolvedValue(session);

    const { queryClient, wrapper } = withQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useCreateSession(), { wrapper });

    result.current.mutate({ title: 'Evening practice' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The root key, so both the paginated list and Home's summary refetch.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.sessionsRoot });
  });

  it('does not touch the cache when the write fails', async () => {
    // Deliberately no optimistic update: sessions are write-once, so if the write fails the
    // user must still be holding their numbers rather than seeing a session that never saved.
    createMock.mockRejectedValue(new Error('offline'));

    const { queryClient, wrapper } = withQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useCreateSession(), { wrapper });

    result.current.mutate({ title: 'Evening practice' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useSessionsSummary', () => {
  it('asks for one page of the most recent sessions, not the whole history', async () => {
    // Home's "this week" total is summed client-side over this page alone — there is no
    // analytics endpoint — so the limit is the accuracy boundary, not just a page size.
    listMock.mockResolvedValue(makePage([makeSession()]));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useSessionsSummary(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledWith({ limit: 100 });
  });

  it('honours an explicit limit', async () => {
    listMock.mockResolvedValue(makePage([]));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useSessionsSummary(10), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledWith({ limit: 10 });
  });

  it('keys apart from the paginated list, which would otherwise collide', async () => {
    // `sessions(filters)` and `sessionsSummary(limit)` were one argument away from
    // producing the same key, which makes TanStack throw on the query-type mismatch.
    expect(queryKeys.sessionsSummary(100)).not.toEqual(queryKeys.sessions({ limit: 100 }));
  });
});

describe('useSession', () => {
  it('fetches one session by id', async () => {
    getMock.mockResolvedValue(makeSession({ id: 'session-9', title: 'Evening practice' }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useSession('session-9'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith('session-9');
    expect(result.current.data?.title).toBe('Evening practice');
  });
});
