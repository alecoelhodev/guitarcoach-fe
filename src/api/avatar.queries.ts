import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSession } from '@/api/auth';
import { deleteAvatar, getAvatarUrl, uploadAvatar } from '@/api/avatar';
import type { UploadFile } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { useSessionStore } from '@/stores/session-store';

/** Inside the backend's 15-minute signature, so a cached URL is never served expired. */
const AVATAR_URL_STALE_MS = 10 * 60_000;

/** `image` is the session user's; no photo means no request. */
export function useAvatarUrl(image: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.avatarUrl(image ?? ''),
    queryFn: getAvatarUrl,
    enabled: Boolean(image),
    staleTime: AVATAR_URL_STALE_MS,
  });
}

/**
 * The upload answers with the URL only, so the new object name — what `user.image` holds —
 * comes from re-reading the session. The URL is seeded under it to skip a second request.
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const setUser = useSessionStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (file: UploadFile) => {
      const avatar = await uploadAvatar(file);
      // The photo is saved by now; a failed re-read must not report the upload as failed.
      // The next boot's session check picks the new photo up.
      const session = await getSession().catch(() => null);
      return { avatar, user: session?.user };
    },
    onSuccess: async ({ avatar, user }) => {
      if (!user?.image) return;
      queryClient.setQueryData(queryKeys.avatarUrl(user.image), avatar);
      await setUser(user);
    },
  });
}

export function useRemoveAvatar() {
  const setUser = useSessionStore((state) => state.setUser);

  return useMutation({
    mutationFn: deleteAvatar,
    onSuccess: async () => {
      const user = useSessionStore.getState().user;
      if (user) await setUser({ ...user, image: null });
    },
  });
}
