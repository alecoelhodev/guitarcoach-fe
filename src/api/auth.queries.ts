import { useMutation, useQueryClient } from '@tanstack/react-query';

import { signOut } from '@/api/auth';
import { clearLocalSession } from '@/stores/clear-local-session';

/**
 * Sign-out clears locally whether or not the server call lands — a failed request must not
 * strand someone in a session they asked to leave. What "locally" covers lives in
 * `clearLocalSession`, shared with the 401 handler so the two cannot forget different things.
 */
export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    onSettled: () => clearLocalSession(queryClient),
  });
}
