import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Both option groups are load-bearing, not defaults-with-extra-steps:
 *
 * - `queries.gcTime: Infinity` schedules no collection timer, so a cache seeded with
 *   `setQueryData` survives for the length of the test.
 * - `mutations.gcTime: 0` matters more: a settled mutation otherwise holds a five-minute
 *   collection timer and Jest will not exit.
 * - `retry: false` on both keeps a test that deliberately triggers an error from waiting
 *   out the real retry schedule.
 *
 * Lifted from `src/api/__tests__/routines.queries.test.tsx`, which had it first.
 */
export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

/** A fresh client per call — sharing one across tests leaks cache between them. */
export function withQueryClient(queryClient = makeTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
}
