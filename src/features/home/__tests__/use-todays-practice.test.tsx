import { renderHook, waitFor } from '@testing-library/react-native';

import { getRoutine, listRoutines, listRoutineTasks } from '@/api/routines';
import { listSessions } from '@/api/sessions';
import { useTodaysPractice } from '@/features/home/use-todays-practice';
import { makePage, makeRoutine, makeRoutineTaskWithTask, makeSession } from '@/test/fixtures';
import { makeTestQueryClient, withQueryClient } from '@/test/query-client';

jest.mock('@/api/routines', () => ({
  getRoutine: jest.fn(),
  listRoutines: jest.fn(),
  listRoutineTasks: jest.fn(),
}));
jest.mock('@/api/sessions', () => ({ listSessions: jest.fn() }));

const getRoutineMock = getRoutine as jest.MockedFunction<typeof getRoutine>;
const listRoutinesMock = listRoutines as jest.MockedFunction<typeof listRoutines>;
const listRoutineTasksMock = listRoutineTasks as jest.MockedFunction<typeof listRoutineTasks>;
const listSessionsMock = listSessions as jest.MockedFunction<typeof listSessions>;

const tasksFor = (routineId: string) => [
  makeRoutineTaskWithTask({ routineId, taskId: `${routineId}-task` }),
];

beforeEach(() => {
  jest.resetAllMocks();
  listSessionsMock.mockResolvedValue(makePage([makeSession({ routineId: 'r-last' })]));
  listRoutineTasksMock.mockImplementation(async (routineId) => tasksFor(routineId));
});

/**
 * Home's cold start used to be sessions → routine → tasks, three round trips in a row. The
 * last-practised routine's tasks now go out with its status check.
 */
it("requests the last-practised routine's tasks without waiting for the routine", async () => {
  getRoutineMock.mockReturnValue(new Promise(() => {}));
  listRoutinesMock.mockResolvedValue(makePage([]));
  const { wrapper } = withQueryClient();

  await renderHook(() => useTodaysPractice(), { wrapper });

  await waitFor(() => expect(listRoutineTasksMock).toHaveBeenCalledWith('r-last'));
  expect(getRoutineMock).toHaveBeenCalledWith('r-last');
});

it('reuses the early fetch when the last-practised routine is the pick', async () => {
  getRoutineMock.mockResolvedValue(makeRoutine({ id: 'r-last', status: 'active' }));
  listRoutinesMock.mockResolvedValue(makePage([]));
  // The app's default staleTime; at the test client's 0 the second observer would refetch.
  const queryClient = makeTestQueryClient();
  queryClient.setQueryDefaults(['routines'], { staleTime: 30_000 });
  const { wrapper } = withQueryClient(queryClient);

  const { result } = await renderHook(() => useTodaysPractice(), { wrapper });

  await waitFor(() => expect(result.current.routineTasks).toEqual(tasksFor('r-last')));
  expect(listRoutineTasksMock).toHaveBeenCalledTimes(1);
});

// Canvas 839: the early fetch must never surface an archived routine's tasks.
it("shows the fallback routine's tasks, not the archived one's", async () => {
  getRoutineMock.mockImplementation(async (id) =>
    makeRoutine({ id, status: id === 'r-last' ? 'archived' : 'active' }),
  );
  listRoutinesMock.mockResolvedValue(makePage([makeRoutine({ id: 'r-active' })]));
  const { wrapper } = withQueryClient();

  const { result } = await renderHook(() => useTodaysPractice(), { wrapper });

  await waitFor(() => expect(result.current.routine?.id).toBe('r-active'));
  await waitFor(() => expect(result.current.routineTasks).toEqual(tasksFor('r-active')));
});
