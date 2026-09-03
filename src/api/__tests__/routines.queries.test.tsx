import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { type ReactNode } from 'react';

import { queryKeys } from '@/api/query-keys';
import { reorderRoutineTasks } from '@/api/routines';
import { useReorderRoutineTasks } from '@/api/routines.queries';
import type { RoutineTaskWithTask } from '@/types/routine';

jest.mock('@/api/routines', () => ({ reorderRoutineTasks: jest.fn() }));

const reorderMock = reorderRoutineTasks as jest.MockedFunction<typeof reorderRoutineTasks>;

const ROUTINE_ID = 'routine-1';

function task(taskId: string): RoutineTaskWithTask {
  return { taskId, task: { id: taskId, title: taskId } } as RoutineTaskWithTask;
}

async function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Infinity schedules no collection timer at all, so the seeded cache survives the test.
      queries: { retry: false, gcTime: Infinity },
      // Without gcTime 0 the settled mutation keeps a five-minute collection timer, and
      // Jest will not exit until it fires.
      mutations: { retry: false, gcTime: 0 },
    },
  });
  queryClient.setQueryData(queryKeys.routineTasks(ROUTINE_ID), [task('a'), task('b'), task('c')]);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

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
