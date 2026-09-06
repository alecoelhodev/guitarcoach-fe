import { renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '@/api/query-keys';
import { listRecordings } from '@/api/recordings';
import { useRecordings } from '@/api/recordings.queries';
import { makeRecording } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';

jest.mock('@/api/recordings', () => ({ listRecordings: jest.fn() }));

const listMock = listRecordings as jest.MockedFunction<typeof listRecordings>;

afterEach(() => jest.resetAllMocks());

describe('useRecordings', () => {
  it('lists a session recordings', async () => {
    listMock.mockResolvedValue([makeRecording({ id: 'r1' })]);

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useRecordings('session-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledWith('session-1');
    expect(result.current.data?.map((r) => r.id)).toEqual(['r1']);
  });

  it('caches under the session detail key, so invalidating a session reaches it', async () => {
    listMock.mockResolvedValue([makeRecording()]);

    const { queryClient, wrapper } = withQueryClient();
    const { result } = await renderHook(() => useRecordings('session-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(queryKeys.recordings('session-1'))).toHaveLength(1);
    // The key nests under `sessions/detail/:id`, so a prefix invalidation of the session
    // refetches its recordings too.
    expect(queryKeys.recordings('session-1').slice(0, 3)).toEqual(queryKeys.session('session-1'));
  });

  it('keeps one session recordings out of another cache entry', async () => {
    listMock.mockResolvedValue([makeRecording()]);

    const { queryClient, wrapper } = withQueryClient();
    const { result } = await renderHook(() => useRecordings('session-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(queryKeys.recordings('session-2'))).toBeUndefined();
  });
});
