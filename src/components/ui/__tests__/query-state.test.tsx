import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { QueryState, type QueryStateQuery } from '@/components/ui/query-state';

/**
 * `QueryStateQuery` is a structural type, so these tests hand it plain objects — no
 * QueryClientProvider, no network, no `renderHook`. That is the reason this component is
 * worth testing directly: five screens depend on the order of its ladder, and the ladder
 * is reachable without any of TanStack's machinery.
 */
function query<T>(overrides: Partial<QueryStateQuery<T>> = {}): QueryStateQuery<T> {
  return {
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    refetch: jest.fn(),
    ...overrides,
  };
}

describe('QueryState', () => {
  it('renders the resolved data once the query settles', async () => {
    await render(
      <QueryState query={query({ data: 'three routines' })}>
        {(data) => <Text>{data}</Text>}
      </QueryState>,
    );

    expect(screen.getByText('three routines')).toBeTruthy();
  });

  it('passes the resolved data to children, so screens keep a non-optional type', async () => {
    const children = jest.fn(() => <Text>rendered</Text>);

    await render(<QueryState query={query({ data: { count: 3 } })}>{children}</QueryState>);

    expect(children).toHaveBeenCalledWith({ count: 3 });
  });

  it('shows neither data nor an error while pending', async () => {
    const children = jest.fn(() => <Text>rendered</Text>);

    await render(
      <QueryState query={query({ isPending: true, data: 'ignored' })}>{children}</QueryState>,
    );

    expect(children).not.toHaveBeenCalled();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('prefers a caller-supplied skeleton over the default card', async () => {
    await render(
      <QueryState query={query({ isPending: true })} skeleton={<Text>custom skeleton</Text>}>
        {() => <Text>rendered</Text>}
      </QueryState>,
    );

    expect(screen.getByText('custom skeleton')).toBeTruthy();
  });

  it('falls back to the skeleton when data is undefined without either flag set', async () => {
    // Unreachable through TanStack's own states, but it is the guard that lets `children`
    // take non-optional data without a cast. Deleting it would need a cast in its place.
    const children = jest.fn(() => <Text>rendered</Text>);

    await render(<QueryState query={query()}>{children}</QueryState>);

    expect(children).not.toHaveBeenCalled();
  });

  describe('errors', () => {
    it('names the connection rather than the caller context when offline', async () => {
      // The whole point of centralising the ladder: `describeError`'s wording reaches every
      // screen without each one re-deciding it.
      await render(
        <QueryState
          query={query({
            isError: true,
            error: new ApiError('No connection', OFFLINE_STATUS),
          })}
          errorTitle="Couldn't load routines"
        >
          {() => <Text>rendered</Text>}
        </QueryState>,
      );

      expect(screen.getByText('No connection')).toBeTruthy();
      expect(screen.getByText('Check your connection and try again.')).toBeTruthy();
      expect(screen.queryByText("Couldn't load routines")).toBeNull();
    });

    it("falls back to the caller's context for an unrecognised failure", async () => {
      await render(
        <QueryState
          query={query({ isError: true, error: new ApiError('Routine name taken', 409) })}
          errorTitle="Couldn't save"
        >
          {() => <Text>rendered</Text>}
        </QueryState>,
      );

      expect(screen.getByText("Couldn't save")).toBeTruthy();
      expect(screen.getByText('Routine name taken')).toBeTruthy();
    });

    it('renders the error panel instead of the data it already holds', async () => {
      const children = jest.fn(() => <Text>rendered</Text>);

      await render(
        <QueryState query={query({ isError: true, error: new ApiError('boom', 500), data: 'x' })}>
          {children}
        </QueryState>,
      );

      expect(screen.getByText('Something went wrong on our end')).toBeTruthy();
      expect(children).not.toHaveBeenCalled();
    });

    it('retries through the query when the panel button is pressed', async () => {
      const refetch = jest.fn();

      await render(
        <QueryState query={query({ isError: true, error: new ApiError('boom', 500), refetch })}>
          {() => <Text>rendered</Text>}
        </QueryState>,
      );
      await fireEvent.press(screen.getByText('Try again'));

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty', () => {
    it('shows a default empty state', async () => {
      await render(
        <QueryState query={query({ data: [] })} isEmpty>
          {() => <Text>rendered</Text>}
        </QueryState>,
      );

      expect(screen.getByText('Nothing here yet')).toBeTruthy();
    });

    it('prefers a caller-supplied empty state', async () => {
      await render(
        <QueryState query={query({ data: [] })} isEmpty empty={<Text>No routines yet</Text>}>
          {() => <Text>rendered</Text>}
        </QueryState>,
      );

      expect(screen.getByText('No routines yet')).toBeTruthy();
    });

    it('is outranked by an error, so a failed load never reads as empty', async () => {
      await render(
        <QueryState
          query={query({ isError: true, error: new ApiError('boom', 500), data: [] })}
          isEmpty
        >
          {() => <Text>rendered</Text>}
        </QueryState>,
      );

      expect(screen.getByText('Something went wrong on our end')).toBeTruthy();
      expect(screen.queryByText('Nothing here yet')).toBeNull();
    });
  });
});
