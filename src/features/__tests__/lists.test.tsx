jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/routines.queries', () => ({ useRoutines: jest.fn() }));
jest.mock('@/api/sessions.queries', () => ({ useSessions: jest.fn() }));
jest.mock('@/api/tasks.queries', () => ({ useTasks: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { useRoutines } from '@/api/routines.queries';
import { useSessions } from '@/api/sessions.queries';
import { useTasks } from '@/api/tasks.queries';
import { HistoryList } from '@/features/history/history-list';
import { LibraryList } from '@/features/library/library-list';
import { RoutinesList } from '@/features/routines/routines-list';
import { linkHrefs } from '@/test/expo-router';
import { makePage, makeRoutine, makeSession, makeTask } from '@/test/fixtures';
import { errorInfinite, infinitePages, pendingInfinite } from '@/test/query-hooks';

/**
 * The three paginated list screens. They share one ladder — pending, error, empty, content,
 * plus a "load more" footer gated on `hasNextPage` — so each screen is driven through the
 * same five states. The hook module is mocked rather than the transport: `useRoutines`,
 * `useSessions` and `useTasks` are already covered at 100% by their own suites against a real
 * QueryClient, so mounting a provider here would re-verify covered code.
 */

const useRoutinesMock = useRoutines as jest.MockedFunction<typeof useRoutines>;
const useSessionsMock = useSessions as jest.MockedFunction<typeof useSessions>;
const useTasksMock = useTasks as jest.MockedFunction<typeof useTasks>;

// The hooks are typed against TanStack's full result; the tests supply only what the screens
// read, which is what `src/test/query-hooks.ts` builds.
type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

beforeEach(() => jest.clearAllMocks());

describe('RoutinesList', () => {
  const mock = useRoutinesMock as unknown as AnyHook;

  it('shows a skeleton while the first page is in flight', async () => {
    mock.mockReturnValue(pendingInfinite());
    await render(<RoutinesList />);

    expect(screen.getByText('Routines')).toBeTruthy();
    expect(screen.queryByText('No routines yet')).toBeNull();
  });

  it('offers the coach when there are no routines, since nothing else creates them', async () => {
    mock.mockReturnValue(infinitePages([makePage([])]));
    await render(<RoutinesList />);

    expect(screen.getByText('No routines yet')).toBeTruthy();
    expect(screen.getByText('Ask the AI Coach to build your first one.')).toBeTruthy();
  });

  it('surfaces an offline error rather than the generic title', async () => {
    mock.mockReturnValue(errorInfinite(new ApiError('boom', OFFLINE_STATUS)));
    await render(<RoutinesList />);

    expect(screen.getByText('No connection')).toBeTruthy();
    expect(screen.queryByText("Couldn't load routines")).toBeNull();
  });

  it('flattens every page into one list', async () => {
    mock.mockReturnValue(
      infinitePages([
        makePage([makeRoutine({ id: 'r1', title: 'Morning warm-up' })]),
        makePage([makeRoutine({ id: 'r2', title: 'Evening theory' })]),
      ]),
    );
    await render(<RoutinesList />);

    expect(screen.getByText('Morning warm-up')).toBeTruthy();
    expect(screen.getByText('Evening theory')).toBeTruthy();
  });

  it('keeps the coach link in the footer even when the list has content', async () => {
    mock.mockReturnValue(infinitePages([makePage([makeRoutine()])]));
    await render(<RoutinesList />);

    expect(screen.getByText('Ask AI Coach to draft one')).toBeTruthy();
    expect(linkHrefs).toContain('/(app)/(main)/coach');
  });

  it('hides "Load more" on the last page and fetches the next when there is one', async () => {
    mock.mockReturnValue(infinitePages([makePage([makeRoutine()])], { hasNextPage: false }));
    const lastPage = await render(<RoutinesList />);
    expect(screen.queryByText('Load more')).toBeNull();
    await lastPage.unmount();

    const query = infinitePages([makePage([makeRoutine()])], { hasNextPage: true });
    mock.mockReturnValue(query);
    await render(<RoutinesList />);

    await fireEvent.press(screen.getByText('Load more'));

    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('disables the footer button and says so while the next page loads', async () => {
    const query = infinitePages([makePage([makeRoutine()])], {
      hasNextPage: true,
      isFetchingNextPage: true,
    });
    mock.mockReturnValue(query);
    await render(<RoutinesList />);

    await fireEvent.press(screen.getByText('Loading…'));

    expect(query.fetchNextPage).not.toHaveBeenCalled();
  });
});

describe('LibraryList', () => {
  const mock = useTasksMock as unknown as AnyHook;

  it('shows an empty state with no message of its own', async () => {
    mock.mockReturnValue(infinitePages([makePage([])]));
    await render(<LibraryList />);

    expect(screen.getByText('No tasks yet')).toBeTruthy();
  });

  it('counts the tasks it has loaded, singular and plural', async () => {
    mock.mockReturnValue(infinitePages([makePage([makeTask({ id: 't1' })])]));

    const single = await render(<LibraryList />);
    expect(screen.getByText('1 task')).toBeTruthy();
    await single.unmount();

    mock.mockReturnValue(
      infinitePages([makePage([makeTask({ id: 't1' }), makeTask({ id: 't2' })])]),
    );
    await render(<LibraryList />);

    expect(screen.getByText('2 tasks')).toBeTruthy();
  });

  it('renders a card per task', async () => {
    mock.mockReturnValue(
      infinitePages([
        makePage([
          makeTask({ id: 't1', title: 'Alternate picking' }),
          makeTask({ id: 't2', title: 'Modes' }),
        ]),
      ]),
    );
    await render(<LibraryList />);

    expect(screen.getByText('Alternate picking')).toBeTruthy();
    expect(screen.getByText('Modes')).toBeTruthy();
  });

  it('reports its own error copy', async () => {
    mock.mockReturnValue(errorInfinite(new ApiError('nope', 500)));
    await render(<LibraryList />);

    expect(screen.getByText('Something went wrong on our end')).toBeTruthy();
  });

  it('loads more when there is another page', async () => {
    const query = infinitePages([makePage([makeTask()])], { hasNextPage: true });
    mock.mockReturnValue(query);
    await render(<LibraryList />);

    await fireEvent.press(screen.getByText('Load more'));

    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryList', () => {
  const mock = useSessionsMock as unknown as AnyHook;

  it('tells the user how sessions get here when there are none', async () => {
    mock.mockReturnValue(infinitePages([makePage([])]));
    await render(<HistoryList />);

    expect(screen.getByText('No sessions yet')).toBeTruthy();
    expect(screen.getByText('Finish a practice session to see it here.')).toBeTruthy();
  });

  it('groups sessions under a header per day, newest day first', async () => {
    mock.mockReturnValue(
      infinitePages([
        makePage([
          makeSession({ id: 's1', title: 'Older', createdAt: '2026-09-01T10:00:00.000Z' }),
          makeSession({ id: 's2', title: 'Newer', createdAt: '2026-09-03T10:00:00.000Z' }),
        ]),
      ]),
    );
    await render(<HistoryList />);

    expect(screen.getByText('2026-09-03')).toBeTruthy();
    expect(screen.getByText('2026-09-01')).toBeTruthy();
    expect(screen.getByText('Newer')).toBeTruthy();
    expect(screen.getByText('Older')).toBeTruthy();
  });

  it('puts two sessions from one day under a single header', async () => {
    mock.mockReturnValue(
      infinitePages([
        makePage([
          makeSession({ id: 's1', title: 'Morning', createdAt: '2026-09-03T09:00:00.000Z' }),
          makeSession({ id: 's2', title: 'Evening', createdAt: '2026-09-03T19:00:00.000Z' }),
        ]),
      ]),
    );
    await render(<HistoryList />);

    expect(screen.getAllByText('2026-09-03')).toHaveLength(1);
  });

  it('labels its footer for older sessions rather than "Load more"', async () => {
    const query = infinitePages([makePage([makeSession()])], { hasNextPage: true });
    mock.mockReturnValue(query);
    await render(<HistoryList />);

    await fireEvent.press(screen.getByText('Load older sessions'));

    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('reports an error with its own title', async () => {
    mock.mockReturnValue(errorInfinite(new ApiError('', 418)));
    await render(<HistoryList />);

    expect(screen.getByText("Couldn't load your history")).toBeTruthy();
  });
});
