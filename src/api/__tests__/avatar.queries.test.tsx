import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getSession } from '@/api/auth';
import { deleteAvatar, getAvatarUrl, uploadAvatar } from '@/api/avatar';
import { useAvatarUrl, useRemoveAvatar, useUploadAvatar } from '@/api/avatar.queries';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { useSessionStore } from '@/stores/session-store';
import { makeUser } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';

jest.mock('@/api/avatar', () => ({
  deleteAvatar: jest.fn(),
  getAvatarUrl: jest.fn(),
  uploadAvatar: jest.fn(),
}));
jest.mock('@/api/auth', () => ({ getSession: jest.fn() }));

const getUrlMock = getAvatarUrl as jest.MockedFunction<typeof getAvatarUrl>;
const uploadMock = uploadAvatar as jest.MockedFunction<typeof uploadAvatar>;
const deleteMock = deleteAvatar as jest.MockedFunction<typeof deleteAvatar>;
const getSessionMock = getSession as jest.MockedFunction<typeof getSession>;

const FILE = { uri: 'file:///avatar.jpg', name: 'avatar.jpg', mimeType: 'image/jpeg' };
const OLD = 'users/u1/avatar/old.jpg';
const NEW = 'users/u1/avatar/new.jpg';

afterEach(() => jest.resetAllMocks());

describe('useAvatarUrl', () => {
  it('asks for nothing when no photo is set', async () => {
    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useAvatarUrl(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getUrlMock).not.toHaveBeenCalled();
  });

  it('fetches the signed URL for a set photo', async () => {
    getUrlMock.mockResolvedValue({ url: 'https://signed/old' });

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useAvatarUrl(OLD), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ url: 'https://signed/old' }));
  });
});

describe('useUploadAvatar', () => {
  it('stores the new photo on the session user and seeds its URL', async () => {
    useSessionStore.setState({ status: 'authenticated', user: makeUser({ image: OLD }) });
    uploadMock.mockResolvedValue({ url: 'https://signed/new' });
    getSessionMock.mockResolvedValue({ user: makeUser({ image: NEW }) });

    const { queryClient, wrapper } = withQueryClient();
    const { result } = await renderHook(() => useUploadAvatar(), { wrapper });
    await act(() => result.current.mutateAsync(FILE));

    expect(uploadMock).toHaveBeenCalledWith(FILE);
    expect(useSessionStore.getState().user?.image).toBe(NEW);
    expect(queryClient.getQueryData(queryKeys.avatarUrl(NEW))).toEqual({
      url: 'https://signed/new',
    });
  });

  it('still succeeds when the session re-read fails after the upload landed', async () => {
    useSessionStore.setState({ status: 'authenticated', user: makeUser({ image: OLD }) });
    uploadMock.mockResolvedValue({ url: 'https://signed/new' });
    getSessionMock.mockRejectedValue(new ApiError('offline', 0));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useUploadAvatar(), { wrapper });
    await act(() => result.current.mutateAsync(FILE));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useSessionStore.getState().user?.image).toBe(OLD);
  });

  it('reports a rejected upload without touching the user', async () => {
    useSessionStore.setState({ status: 'authenticated', user: makeUser({ image: OLD }) });
    uploadMock.mockRejectedValue(new ApiError('too large', 413));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useUploadAvatar(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(FILE)).rejects.toThrow('too large');
    });

    expect(getSessionMock).not.toHaveBeenCalled();
    expect(useSessionStore.getState().user?.image).toBe(OLD);
  });
});

describe('useRemoveAvatar', () => {
  it('clears the photo from the session user', async () => {
    useSessionStore.setState({ status: 'authenticated', user: makeUser({ image: OLD }) });
    deleteMock.mockResolvedValue(undefined);

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useRemoveAvatar(), { wrapper });
    await act(() => result.current.mutateAsync());

    expect(useSessionStore.getState().user).toMatchObject({ id: 'u1', image: null });
  });
});
