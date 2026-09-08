import { renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '@/api/query-keys';
import { getRoutine, listRoutines, listRoutineTasks, reorderRoutineTasks } from '@/api/routines';
import {
  useReorderRoutineTasks,
  useRoutine,
  useRoutines,
  useRoutineTasks,
} from '@/api/routines.queries';
import { makePage, makeRoutine } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';
import type { RoutineTaskWithTask } from '@/types/routine';

jest.mock('@/api/routines', () => ({
  getRoutine: jest.fn(),
  listRoutines: jest.fn(),
  listRoutineTasks: jest.fn(),
  reorderRoutineTasks: jest.fn(),
}));

const reorderMock = reorderRoutineTasks as jest.MockedFunction<typeof reorderRoutineTasks>;
const listRoutinesMock = listRoutines as jest.MockedFunction<typeof listRoutines>;
const getRoutineMock = getRoutine as jest.MockedFunction<typeof getRoutine>;
const listRoutineTasksMock = listRoutineTasks as jest.MockedFunction<typeof listRoutineTasks>;

const ROUTINE_ID = 'routine-1';

function task(taskId: string): RoutineTaskWithTask {
  return { taskId, task: { id: taskId, title: taskId } } as RoutineTaskWithTask;
}

async function setup() {
  // The client's gcTime/retry options are load-bearing; see src/test/query-client.tsx.
  const { queryClient, wrapper } = withQueryClient();
  queryClient.setQueryData(queryKeys.routineTasks(ROUTINE_ID), [task('a'), task('b'), task('c')]);

  // RNTL 14's renderHook is async — it awaits the initial render internally.
  const { result } = await renderHook(() => useReorderRoutineTasks(ROUTINE_ID), { wrapper });

  const order = () =>
    queryClient
      .getQueryData<RoutineTaskWithTask[]>(queryKeys.routineTasks(ROUTINE_ID))
      ?.map((t) => t.taskId);

  return { result, order };
}

describe('useReorderRoutineTasks', () => {
  afterEach(() => jest.resetAllMocks());

  it('reorders the cache before the request goes out, not after it returns', async () => {
    let orderWhenRequested: string[] | undefined;

    const { result, order } = await setup();
    reorderMock.mockImplementation(async () => {
      orderWhenRequested = order();
      return [];
    });

    result.current.mutate(['c', 'a', 'b']);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orderWhenRequested).toEqual(['c', 'a', 'b']);
  });

  it('restores the previous order when the write fails', async () => {
    reorderMock.mockRejectedValue(new Error('offline'));

    const { result, order } = await setup();
    result.current.mutate(['c', 'a', 'b']);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('drops ids the cache does not know rather than rendering holes', async () => {
    let orderWhenRequested: string[] | undefined;

    const { result, order } = await setup();
    reorderMock.mockImplementation(async () => {
      orderWhenRequested = order();
      return [];
    });

    result.current.mutate(['c', 'ghost', 'a', 'b']);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orderWhenRequested).toEqual(['c', 'a', 'b']);
  });
});

describe('useRoutines', () => {
  afterEach(() => jest.resetAllMocks());

  it('asks for page 1 first and flattens what comes back', async () => {
    listRoutinesMock.mockResolvedValue(makePage([makeRoutine({ id: 'r1' })]));
    const { wrapper } = withQueryClient();

    const { result } = await renderHook(() => useRoutines(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listRoutinesMock).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data?.pages[0].data).toHaveLength(1);
  });

  it('forwards its filters alongside the page', async () => {
    listRoutinesMock.mockResolvedValue(makePage([]));
    const { wrapper } = withQueryClient();

    const { result } = await renderHook(() => useRoutines({ status: 'archived', limit: 5 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listRoutinesMock).toHaveBeenCalledWith({ status: 'archived', limit: 5, page: 1 });
  });

  it('offers a next page while one remains', async () => {
    listRoutinesMock.mockResolvedValue(makePage([makeRoutine()], { page: 1, totalPages: 3 }));
    const { wrapper } = withQueryClient();

    const { result } = await renderHook(() => useRoutines(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('stops at the last page rather than fetching past it', async () => {
    listRoutinesMock.mockResolvedValue(makePage([makeRoutine()], { page: 3, totalPages: 3 }));
    const { wrapper } = withQueryClient();

    const { result } = await renderHook(() => useRoutines(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe('useRoutine', () => {
  afterEach(() => jest.resetAllMocks());

  it('fetches one routine under its own key', async () => {
    const routine = makeRoutine({ id: 'r5' });
    getRoutineMock.mockResolvedValue(routine);
    const { queryClient, wrapper } = withQueryClient();

    const { result } = await renderHook(() => useRoutine('r5'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRoutineMock).toHaveBeenCalledWith('r5');
    expect(queryClient.getQueryData(queryKeys.routine('r5'))).toEqual(routine);
  });
});

describe('useRoutineTasks', () => {
  afterEach(() => jest.resetAllMocks());

  it("fetches a routine's tasks under the key the reorder mutation writes to", async () => {
    listRoutineTasksMock.mockResolvedValue([task('a')]);
    const { queryClient, wrapper } = withQueryClient();

    const { result } = await renderHook(() => useRoutineTasks(ROUTINE_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listRoutineTasksMock).toHaveBeenCalledWith(ROUTINE_ID);
    expect(queryClient.getQueryData(queryKeys.routineTasks(ROUTINE_ID))).toHaveLength(1);
  });
});
