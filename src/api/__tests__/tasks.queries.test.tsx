import { renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '@/api/query-keys';
import { createTask, getTask, listTasks } from '@/api/tasks';
import { useCreateTask, useTask, useTasks } from '@/api/tasks.queries';
import { makePage, makeTask } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';

jest.mock('@/api/tasks', () => ({
  listTasks: jest.fn(),
  getTask: jest.fn(),
  createTask: jest.fn(),
}));

const listMock = listTasks as jest.MockedFunction<typeof listTasks>;
const getMock = getTask as jest.MockedFunction<typeof getTask>;
const createMock = createTask as jest.MockedFunction<typeof createTask>;

afterEach(() => jest.resetAllMocks());

describe('useTasks pagination', () => {
  it.each([
    ['offers another page mid-list', 1, 4, true],
    ['stops on the final page', 4, 4, false],
    ['stops on an empty catalog', 1, 0, false],
  ])('%s', async (_label, page, totalPages, hasNextPage) => {
    listMock.mockResolvedValue(makePage([makeTask()], { page, totalPages }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(hasNextPage);
  });

  it('keeps the category and difficulty filters on the paged request', async () => {
    listMock.mockResolvedValue(makePage([], { page: 1, totalPages: 1 }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(
      () => useTasks({ category: 'technique', difficulty: 'easy' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledWith({
      category: 'technique',
      difficulty: 'easy',
      page: 1,
    });
  });

  it('keys separate filter combinations separately', async () => {
    listMock.mockResolvedValue(makePage([makeTask()], { page: 1, totalPages: 1 }));

    const { wrapper } = withQueryClient();
    await renderHook(() => useTasks({ category: 'technique' }), { wrapper });
    await renderHook(() => useTasks({ category: 'theory' }), { wrapper });

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });
});

describe('useTasks filter changes', () => {
  it('keeps the previous list on screen while the new filter loads', async () => {
    listMock.mockResolvedValueOnce(makePage([makeTask({ id: 'all' })], { page: 1, totalPages: 1 }));
    listMock.mockReturnValueOnce(new Promise(() => {}));

    const { wrapper } = withQueryClient();
    const { result, rerender } = await renderHook(
      ({ category }: { category?: 'theory' }) => useTasks({ category }),
      { wrapper, initialProps: {} },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await rerender({ category: 'theory' });

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.pages[0].data[0].id).toBe('all');
  });
});

describe('useTask', () => {
  it('fetches one task by id', async () => {
    getMock.mockResolvedValue(makeTask({ id: 'task-9', title: 'Sweep picking' }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useTask('task-9'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith('task-9');
    expect(result.current.data?.title).toBe('Sweep picking');
  });

  it('shares one request between the rows that ask for the same task', async () => {
    // `session-detail` renders one `useTask` per session task, so the detail key doing its
    // job is what keeps that from becoming one request per row per mount.
    getMock.mockResolvedValue(makeTask({ id: 'task-9' }));

    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useTask('task-9'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await renderHook(() => useTask('task-9'), { wrapper });

    expect(getMock).toHaveBeenCalledTimes(1);
  });
});

describe('useCreateTask', () => {
  it('invalidates every task list once the task is created', async () => {
    createMock.mockResolvedValue(makeTask({ id: 'new' }));
    const { queryClient, wrapper } = withQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useCreateTask(), { wrapper });
    await result.current.mutateAsync({ title: 'Modes' });

    expect(createMock).toHaveBeenCalledWith({ title: 'Modes' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.tasksRoot });
  });

  it('invalidates nothing when the create fails', async () => {
    createMock.mockRejectedValue(new Error('403'));
    const { queryClient, wrapper } = withQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useCreateTask(), { wrapper });
    await expect(result.current.mutateAsync({ title: 'Modes' })).rejects.toThrow('403');

    expect(invalidate).not.toHaveBeenCalled();
  });
});
