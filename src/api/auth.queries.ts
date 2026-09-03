import { useMutation, useQueryClient } from '@tanstack/react-query';

import { signOut } from '@/api/auth';
import { purgePersistedCache } from '@/api/persist';
import { useSessionStore } from '@/stores/session-store';

/**
 * Sign-out clears locally whether or not the server call lands — a failed request must not
 * strand someone in a session they asked to leave. Both caches go with it: the in-memory
 * one and the persisted snapshot, which `queryClient.clear()` does not touch.
 */
export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    onSettled: async () => {
      useSessionStore.getState().clear();
      queryClient.clear();
      await purgePersistedCache();
    },
  });
}
