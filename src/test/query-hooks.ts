import type { Paginated } from '@/types/pagination';

/**
 * Stand-ins for what a `*.queries.ts` hook hands a screen.
 *
 * Screens mock the hook module rather than the transport: the five `*.queries.ts` suites
 * already cover those hooks at 100% against a real `QueryClient`, so re-mounting a provider
 * per screen test would re-verify covered code and make every assertion wait on `waitFor`.
 * `QueryState`'s own suite already takes this shape — its `query` prop is structural.
 *
 * Each builder returns the *whole* surface a screen reads, so a screen that starts using
 * `isFetching` or `error` does not silently get `undefined`.
 */

type QueryLike<T> = {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: jest.Mock;
};

export function pendingQuery<T>(): QueryLike<T> {
  return { data: undefined, isPending: true, isError: false, error: null, refetch: jest.fn() };
}

export function successQuery<T>(data: T): QueryLike<T> {
  return { data, isPending: false, isError: false, error: null, refetch: jest.fn() };
}

export function errorQuery<T>(error: Error): QueryLike<T> {
  return { data: undefined, isPending: false, isError: true, error, refetch: jest.fn() };
}

/**
 * `data === undefined` while neither flag is set. Rare in production but it is the guard that
 * lets `QueryState` keep `children` non-optional, so screens with a hand-rolled ladder need
 * it too.
 */
export function emptyQuery<T>(): QueryLike<T> {
  return { data: undefined, isPending: false, isError: false, error: null, refetch: jest.fn() };
}

type InfiniteQueryLike<T> = QueryLike<{ pages: Paginated<T>[] }> & {
  fetchNextPage: jest.Mock;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};

/**
 * The three list screens all read `data?.pages.flatMap((page) => page.data) ?? []`, so pages
 * go in as `makePage()` results. `hasNextPage` and `isFetchingNextPage` drive the footer
 * button and its "Loading…" label, which is the only branching those screens own.
 */
export function infinitePages<T>(
  pages: Paginated<T>[],
  overrides: Partial<Omit<InfiniteQueryLike<T>, 'data'>> = {},
): InfiniteQueryLike<T> {
  return {
    ...successQuery({ pages }),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    ...overrides,
  };
}

export function pendingInfinite<T>(): InfiniteQueryLike<T> {
  return {
    ...pendingQuery<{ pages: Paginated<T>[] }>(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}

export function errorInfinite<T>(error: Error): InfiniteQueryLike<T> {
  return {
    ...errorQuery<{ pages: Paginated<T>[] }>(error),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}

/** A `useMutation` result. `mutateAsync` resolves so `await` in a handler completes. */
export function mutationStub<TData = unknown>(data?: TData) {
  return {
    mutate: jest.fn(),
    mutateAsync: jest.fn(async () => data as TData),
    isPending: false,
    isError: false,
    error: null,
    reset: jest.fn(),
  };
}
