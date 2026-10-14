import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
import { createSession, getSession, listSessions, updateSession } from '@/api/sessions';
import type { UpdateSessionInput } from '@/types/session';

export function useSessions(filters: { limit?: number } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.sessions(filters),
    queryFn: ({ pageParam }) => listSessions({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
    staleTime: 15_000,
  });
}

/** Home's "this week" total is a client-side sum (no analytics endpoint) over the most
 * recent `limit` sessions — not the full history. */
export function useSessionsSummary(limit = 100) {
  return useQuery({
    queryKey: queryKeys.sessionsSummary(limit),
    queryFn: () => listSessions({ limit }),
    staleTime: 15_000,
  });
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => getSession(sessionId),
  });
}

/** No optimistic update — if the write fails the user must still be holding their numbers. */
export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionsRoot });
    },
  });
}

/** A resumed session's Finish. `sessionsRoot` covers the list, the summary and the detail. */
export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: UpdateSessionInput }) =>
      updateSession(sessionId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionsRoot });
    },
  });
}
