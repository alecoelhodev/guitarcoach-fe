import { renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import {
  addRoutineTask,
  createRoutine,
  deleteRoutine,
  getRoutine,
  listRoutines,
  listRoutineTasks,
  removeRoutineTask,
  reorderRoutineTasks,
  updateRoutine,
  updateRoutineTask,
} from '@/api/routines';
import {
  useAddRoutineTask,
  useCreateRoutine,
  useDeleteRoutine,
  useFetchRoutineTasks,
  useRemoveRoutineTask,
  useReorderRoutineTasks,
  useRoutine,
  useRoutines,
  useRoutineTasks,
  useUpdateRoutine,
  useUpdateRoutineTask,
} from '@/api/routines.queries';
import { makePage, makeRoutine } from '@/test/fixtures';
import { makeTestQueryClient, withQueryClient } from '@/test/query-client';
import type { RoutineTaskWithTask } from '@/types/routine';

jest.mock('@/api/routines', () => ({
  addRoutineTask: jest.fn(),
  createRoutine: jest.fn(),
  deleteRoutine: jest.fn(),
  getRoutine: jest.fn(),
  listRoutines: jest.fn(),
  listRoutineTasks: jest.fn(),
  removeRoutineTask: jest.fn(),
  reorderRoutineTasks: jest.fn(),
  updateRoutine: jest.fn(),
  updateRoutineTask: jest.fn(),
}));

const reorderMock = reorderRoutineTasks as jest.MockedFunction<typeof reorderRoutineTasks>;
const listRoutinesMock = listRoutines as jest.MockedFunction<typeof listRoutines>;
const getRoutineMock = getRoutine as jest.MockedFunction<typeof getRoutine>;
const listRoutineTasksMock = listRoutineTasks as jest.MockedFunction<typeof listRoutineTasks>;
const createRoutineMock = createRoutine as jest.MockedFunction<typeof createRoutine>;
const updateRoutineMock = updateRoutine as jest.MockedFunction<typeof updateRoutine>;
const deleteRoutineMock = deleteRoutine as jest.MockedFunction<typeof deleteRoutine>;
const addRoutineTaskMock = addRoutineTask as jest.MockedFunction<typeof addRoutineTask>;
const updateRoutineTaskMock = updateRoutineTask as jest.MockedFunction<typeof updateRoutineTask>;
const removeRoutineTaskMock = removeRoutineTask as jest.MockedFunction<typeof removeRoutineTask>;

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

/**
 * The write hooks share one assertion: did the cache the server just contradicted get
 * marked stale? Seeding all three routine keys and reading `isInvalidated` proves it
 * without a second round of transport mocks — an invalidated query with no observer is
 * flagged rather than refetched, so nothing else moves.
 */
function seedRoutineCache() {
  const { queryClient, wrapper } = withQueryClient();

  queryClient.setQueryData(queryKeys.routines({}), makePage([makeRoutine({ id: ROUTINE_ID })]));
  queryClient.setQueryData(queryKeys.routine(ROUTINE_ID), makeRoutine({ id: ROUTINE_ID }));
  queryClient.setQueryData(queryKeys.routineTasks(ROUTINE_ID), [task('a')]);

  const staleness = () => ({
    list: queryClient.getQueryState(queryKeys.routines({}))?.isInvalidated,
    detail: queryClient.getQueryState(queryKeys.routine(ROUTINE_ID))?.isInvalidated,
    tasks: queryClient.getQueryState(queryKeys.routineTasks(ROUTINE_ID))?.isInvalidated,
  });

  return { queryClient, wrapper, staleness };
}

const ALL_STALE = { list: true, detail: true, tasks: true };
const NONE_STALE = { list: false, detail: false, tasks: false };

describe('useCreateRoutine', () => {
  afterEach(() => jest.resetAllMocks());

  it('creates a routine and stales every routine list', async () => {
    createRoutineMock.mockResolvedValue(makeRoutine({ id: 'new' }));
    const { wrapper, staleness } = seedRoutineCache();

    const { result } = await renderHook(() => useCreateRoutine(), { wrapper });
    result.current.mutate({ title: 'Warm-up' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createRoutineMock).toHaveBeenCalledWith({ title: 'Warm-up' });
    expect(staleness()).toEqual(ALL_STALE);
  });

  it('leaves the cache alone when the write fails', async () => {
    createRoutineMock.mockRejectedValue(new ApiError('Routine name already taken', 409));
    const { wrapper, staleness } = seedRoutineCache();

    const { result } = await renderHook(() => useCreateRoutine(), { wrapper });
    result.current.mutate({ title: 'Warm-up' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(staleness()).toEqual(NONE_STALE);
  });
});

describe('useUpdateRoutine', () => {
  afterEach(() => jest.resetAllMocks());

  // Archiving moves a routine between the Active and Archived lists, so the lists go stale
  // alongside the detail the user is looking at.
  it('patches the routine and stales both its detail and the lists it moves between', async () => {
    updateRoutineMock.mockResolvedValue(makeRoutine({ id: ROUTINE_ID, status: 'archived' }));
    const { wrapper, staleness } = seedRoutineCache();

    const { result } = await renderHook(() => useUpdateRoutine(ROUTINE_ID), { wrapper });
    result.current.mutate({ status: 'archived' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateRoutineMock).toHaveBeenCalledWith(ROUTINE_ID, { status: 'archived' });
    expect(staleness()).toEqual(ALL_STALE);
  });
});

describe('useDeleteRoutine', () => {
  afterEach(() => jest.resetAllMocks());

  it('drops the deleted detail from the cache instead of marking it stale', async () => {
    deleteRoutineMock.mockResolvedValue(undefined);
    const { queryClient, wrapper, staleness } = seedRoutineCache();

    const { result } = await renderHook(() => useDeleteRoutine(), { wrapper });
    result.current.mutate(ROUTINE_ID);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteRoutineMock).toHaveBeenCalledWith(ROUTINE_ID);
    // Marking it stale would refetch an id the server just deleted and render a 404.
    expect(queryClient.getQueryState(queryKeys.routine(ROUTINE_ID))).toBeUndefined();
    expect(staleness().list).toBe(true);
  });

  // The backend refuses to delete a routine that still has tasks attached.
  it('keeps the routine cached when the delete is refused', async () => {
    deleteRoutineMock.mockRejectedValue(new ApiError('Routine still has tasks', 409));
    const { queryClient, wrapper, staleness } = seedRoutineCache();

    const { result } = await renderHook(() => useDeleteRoutine(), { wrapper });
    result.current.mutate(ROUTINE_ID);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(queryKeys.routine(ROUTINE_ID))).toBeDefined();
    expect(staleness()).toEqual(NONE_STALE);
  });
});

describe('useAddRoutineTask', () => {
  afterEach(() => jest.resetAllMocks());

  // `taskCount` and `totalTargetDurationMinutes` are server-computed and live on the list
  // response, so the list cards go stale too — not just the routine being edited.
  it('adds a task and stales the list, the detail and the task list', async () => {
    addRoutineTaskMock.mockResolvedValue({} as Awaited<ReturnType<typeof addRoutineTask>>);
    const { wrapper, staleness } = seedRoutineCache();

    const { result } = await renderHook(() => useAddRoutineTask(ROUTINE_ID), { wrapper });
    result.current.mutate({ taskId: 'task-9' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addRoutineTaskMock).toHaveBeenCalledWith(ROUTINE_ID, { taskId: 'task-9' });
    expect(staleness()).toEqual(ALL_STALE);
  });

  // A task may appear at most once per routine; a duplicate is the wireframe's
  // "already in this routine" state, not a generic failure.
  it('surfaces the duplicate conflict without touching the cache', async () => {
    addRoutineTaskMock.mockRejectedValue(new ApiError('Task already in routine', 409));
    const { wrapper, staleness } = seedRoutineCache();

    const { result } = await renderHook(() => useAddRoutineTask(ROUTINE_ID), { wrapper });
    result.current.mutate({ taskId: 'task-9' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError).status).toBe(409);
    expect(staleness()).toEqual(NONE_STALE);
  });
});

describe('useUpdateRoutineTask', () => {
  afterEach(() => jest.resetAllMocks());

  it('threads the task id through alongside the patch', async () => {
    updateRoutineTaskMock.mockResolvedValue({} as Awaited<ReturnType<typeof updateRoutineTask>>);
    const { wrapper, staleness } = seedRoutineCache();

    const { result } = await renderHook(() => useUpdateRoutineTask(ROUTINE_ID), { wrapper });
    result.current.mutate({ taskId: 'task-9', input: { targetDurationMinutes: 15 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateRoutineTaskMock).toHaveBeenCalledWith(ROUTINE_ID, 'task-9', {
      targetDurationMinutes: 15,
    });
    expect(staleness()).toEqual(ALL_STALE);
  });
});

describe('useRemoveRoutineTask', () => {
  afterEach(() => jest.resetAllMocks());

  it('removes the task and stales the counts that depend on it', async () => {
    removeRoutineTaskMock.mockResolvedValue(undefined);
    const { wrapper, staleness } = seedRoutineCache();

    const { result } = await renderHook(() => useRemoveRoutineTask(ROUTINE_ID), { wrapper });
    result.current.mutate('task-9');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(removeRoutineTaskMock).toHaveBeenCalledWith(ROUTINE_ID, 'task-9');
    expect(staleness()).toEqual(ALL_STALE);
  });
});

describe('useFetchRoutineTasks', () => {
  afterEach(() => jest.resetAllMocks());

  it('fetches on demand and writes into the same key useRoutineTasks reads', async () => {
    listRoutineTasksMock.mockResolvedValue([task('a')]);
    const { queryClient, wrapper } = withQueryClient();

    const { result } = await renderHook(() => useFetchRoutineTasks(), { wrapper });
    const tasks = await result.current(ROUTINE_ID);

    expect(listRoutineTasksMock).toHaveBeenCalledWith(ROUTINE_ID);
    expect(tasks.map((t) => t.taskId)).toEqual(['a']);
    expect(queryClient.getQueryData(queryKeys.routineTasks(ROUTINE_ID))).toHaveLength(1);
  });

  // The reason a list card can afford a Start button: opening the routine first makes the
  // press cost nothing.
  it('serves a fresh cached task list without going back to the transport', async () => {
    // `makeTestQueryClient` leaves staleTime at 0, where `fetchQuery` always refetches. The
    // app's client (src/api/query-client.ts) uses 30s, and that is what makes an
    // already-loaded list free — so mirror it rather than assert behaviour the app lacks.
    const client = makeTestQueryClient();
    client.setDefaultOptions({
      queries: { ...client.getDefaultOptions().queries, staleTime: 30_000 },
    });

    const { queryClient, wrapper } = withQueryClient(client);
    queryClient.setQueryData(queryKeys.routineTasks(ROUTINE_ID), [task('a'), task('b')]);

    const { result } = await renderHook(() => useFetchRoutineTasks(), { wrapper });
    const tasks = await result.current(ROUTINE_ID);

    expect(listRoutineTasksMock).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(2);
  });

  it('rejects rather than resolving empty when the fetch fails', async () => {
    listRoutineTasksMock.mockRejectedValue(new ApiError('boom', 500));
    const { wrapper } = withQueryClient();

    const { result } = await renderHook(() => useFetchRoutineTasks(), { wrapper });

    await expect(result.current(ROUTINE_ID)).rejects.toThrow('boom');
  });
});
