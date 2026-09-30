import { useMutation, useQueryClient } from '@tanstack/react-query';

import { signOut } from '@/api/auth';
import { clearLocalSession } from '@/stores/clear-local-session';

/**
 * Sign-out clears locally whether or not the server call lands — a failed request must not
 * strand someone in a session they asked to leave. What "locally" covers lives in
 * `clearLocalSession`, shared with the 401 handler so the two cannot forget different things.
 *
 * But clearing locally is not signing out. The cookie lives in the platform's own store,
 * which nothing here can reach, so a failed request leaves it alive — and `getSession()` on
 * the next cold start would hand the account straight back. Hence the retries, against the
 * global `mutations: { retry: 0 }`: this is the one mutation where giving up quietly has a
 * consequence the user cannot see. Callers surface `onError` so they can at least be told.
 */
export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    retry: 2,
    retryDelay: (attempt) => 500 * 2 ** attempt,
    onSettled: () => clearLocalSession(queryClient),
  });
}
