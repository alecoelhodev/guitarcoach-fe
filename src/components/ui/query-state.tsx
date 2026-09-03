import { type ReactElement, type ReactNode } from 'react';

import { describeError } from '@/api/errors';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Skeleton } from '@/components/ui/skeleton';

/** Structural subset of a query result — `useQuery` and `useInfiniteQuery` both satisfy it. */
export type QueryStateQuery<T> = {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  refetch: () => unknown;
};

export type QueryStateProps<T> = {
  query: QueryStateQuery<T>;
  /** Rendered while pending. Defaults to a single full-width bar. */
  skeleton?: ReactNode;
  /** Context shown when the failure has no recognised cause, e.g. "Couldn't load the library". */
  errorTitle?: string;
  isEmpty?: boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
};

/**
 * The loading/error/empty ladder every list and detail screen repeats. Centralising it is
 * what puts `describeError`'s wording — "No connection" rather than a generic panel — on
 * every screen without each one re-deciding.
 *
 * `children` takes the resolved data so screens keep the non-optional type they had from
 * TanStack's own narrowing.
 */
export function QueryState<T>({
  query,
  skeleton,
  errorTitle,
  isEmpty = false,
  empty,
  children,
}: QueryStateProps<T>): ReactElement {
  const pending = <>{skeleton ?? <Skeleton height={80} />}</>;

  if (query.isPending) return pending;

  if (query.isError) {
    const { title, message } = describeError(query.error, errorTitle);
    return <ErrorPanel title={title} message={message} onRetry={() => query.refetch()} />;
  }

  // Not reachable through the states above, but it is what makes `children` non-optional
  // without a cast.
  if (query.data === undefined) return pending;

  if (isEmpty) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;

  return <>{children(query.data)}</>;
}
