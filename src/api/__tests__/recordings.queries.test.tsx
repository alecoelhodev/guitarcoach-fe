import { renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { deleteRecording, listRecordings, uploadRecording } from '@/api/recordings';
import { useDeleteRecording, useRecordings, useUploadRecording } from '@/api/recordings.queries';
import { makeRecording } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';

jest.mock('@/api/recordings', () => ({
  deleteRecording: jest.fn(),
  listRecordings: jest.fn(),
  uploadRecording: jest.fn(),
}));

const listMock = listRecordings as jest.MockedFunction<typeof listRecordings>;
const uploadMock = uploadRecording as jest.MockedFunction<typeof uploadRecording>;
const deleteMock = deleteRecording as jest.MockedFunction<typeof deleteRecording>;

const FILE = { uri: 'file:///take-1.m4a', name: 'take-1.m4a', mimeType: 'audio/m4a' };

/** Seeds the list the write hooks are supposed to stale, and reads back whether they did. */
function seedRecordings(sessionId: string) {
  const { queryClient, wrapper } = withQueryClient();
  queryClient.setQueryData(queryKeys.recordings(sessionId), [makeRecording({ id: 'r1' })]);

  const isStale = (id = sessionId) =>
    queryClient.getQueryState(queryKeys.recordings(id))?.isInvalidated;

  return { queryClient, wrapper, isStale };
}

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

describe('useUploadRecording', () => {
  it('uploads against its session and stales that session recordings', async () => {
    uploadMock.mockResolvedValue(makeRecording({ id: 'r2' }));
    const { wrapper, isStale } = seedRecordings('session-1');

    const { result } = await renderHook(() => useUploadRecording('session-1'), { wrapper });
    result.current.mutate(FILE);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(uploadMock).toHaveBeenCalledWith('session-1', FILE);
    expect(isStale()).toBe(true);
  });

  it('leaves the list intact when the upload fails', async () => {
    uploadMock.mockRejectedValue(new ApiError('File too large', 413));
    const { wrapper, isStale } = seedRecordings('session-1');

    const { result } = await renderHook(() => useUploadRecording('session-1'), { wrapper });
    result.current.mutate(FILE);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isStale()).toBe(false);
  });
});

describe('useDeleteRecording', () => {
  // The endpoint is keyed by recording; only the cache key needs the session.
  it('deletes by recording id and stales the session it was bound to', async () => {
    deleteMock.mockResolvedValue(undefined);
    const { wrapper, isStale } = seedRecordings('session-1');

    const { result } = await renderHook(() => useDeleteRecording('session-1'), { wrapper });
    result.current.mutate('r1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteMock).toHaveBeenCalledWith('r1');
    expect(isStale()).toBe(true);
  });

  it('stales only the session it was given, not every session recordings', async () => {
    deleteMock.mockResolvedValue(undefined);
    const { queryClient, wrapper, isStale } = seedRecordings('session-1');
    queryClient.setQueryData(queryKeys.recordings('session-2'), [makeRecording({ id: 'r9' })]);

    const { result } = await renderHook(() => useDeleteRecording('session-1'), { wrapper });
    result.current.mutate('r1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(isStale('session-2')).toBe(false);
  });
});
