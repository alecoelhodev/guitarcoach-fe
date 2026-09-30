import type { UseInfiniteQueryResult } from '@tanstack/react-query';

/**
 * Splits an infinite query into the part `QueryState` should see and the part the list footer
 * owns.
 *
 * A failed *next* page keeps every page already on screen, but TanStack still reports it on
 * the query as `isError`, and `QueryState` checks `isError` before `data` — so without this
 * one bad page replaces a screen full of loaded rows with a full-width error panel. The
 * Library had worked around it inline; Routines, History and Add tasks had not, which is
 * what this exists to stop happening again.
 *
 * `loadMore` is deliberately inert while a page is in flight or has just failed. `FlatList`
 * fires `onEndReached` repeatedly during momentum, so a page that failed would otherwise
 * retry itself on every scroll event rather than waiting for the footer's Try again.
 */
export function usePaginatedList<TData, TError>(query: UseInfiniteQueryResult<TData, TError>) {
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = query;

  return {
    listState: {
      data: query.data,
      isPending: query.isPending,
      isError: query.isError && !isFetchNextPageError,
      error: query.error,
      refetch: query.refetch,
    },
    hasNextPage,
    isFetchingNextPage,
    isNextPageError: isFetchNextPageError,
    loadMore: () => {
      if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) fetchNextPage();
    },
    retryNextPage: () => fetchNextPage(),
    /**
     * Pull-to-refresh. `isRefetching` rather than `isFetching` so the spinner tracks the
     * user's own pull and not a background refetch — `refetchOnWindowFocus` is on, so every
     * return to the app would otherwise flash the control.
     */
    refresh: () => {
      query.refetch();
    },
    isRefreshing: query.isRefetching && !isFetchingNextPage,
  };
}
