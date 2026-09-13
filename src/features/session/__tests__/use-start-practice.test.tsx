jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/routines', () => ({ listRoutineTasks: jest.fn() }));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { listRoutineTasks } from '@/api/routines';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useStartPractice } from '@/features/session/use-start-practice';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { makeRoutine } from '@/test/fixtures';
import { withQueryClient } from '@/test/query-client';
import type { RoutineTaskWithTask } from '@/types/routine';

/**
 * The shared half of canvas 840 — "Start Practice creates nothing". All three entry points
 * (Home's today card, the web routine grid, routine detail) run through this, so the task
 * mapping and the navigation are asserted here once rather than per screen.
 */

const listRoutineTasksMock = listRoutineTasks as jest.MockedFunction<typeof listRoutineTasks>;

const ROUTINE = makeRoutine({ id: 'r1', title: 'Morning warm-up' });

function routineTask(taskId: string, title: string, minutes: number | null): RoutineTaskWithTask {
  return {
    taskId,
    targetDurationMinutes: minutes,
    task: { id: taskId, title },
  } as unknown as RoutineTaskWithTask;
}

const TASKS = [
  routineTask('a', 'Alternate picking', 10),
  // No target, so minutes start at 0 rather than undefined — the Stepper needs a number.
  routineTask('c', 'Modes', null),
];

beforeEach(() => {
  jest.clearAllMocks();
});

it('seeds the local session from tasks it was handed, and navigates', async () => {
  const { wrapper } = withQueryClient();
  const { result } = await renderHook(() => useStartPractice(), { wrapper });

  await act(async () => {
    result.current.mutate({ routine: ROUTINE, tasks: TASKS });
  });

  await waitFor(() =>
    expect(useActiveSessionStore.getState()).toMatchObject({
      routineId: 'r1',
      title: 'Morning warm-up',
      tasks: [
        {
          taskId: 'a',
          title: 'Alternate picking',
          targetDurationMinutes: 10,
          durationMinutes: 10,
          completed: false,
        },
        {
          taskId: 'c',
          title: 'Modes',
          targetDurationMinutes: undefined,
          durationMinutes: 0,
          completed: false,
        },
      ],
    }),
  );
  expect(mockRouter.push).toHaveBeenCalledWith('/session/active');
  // Handed the tasks, so it must not spend a request re-fetching them.
  expect(listRoutineTasksMock).not.toHaveBeenCalled();
});

it('fetches the tasks when the caller has none, which is the routine grid on web', async () => {
  listRoutineTasksMock.mockResolvedValue(TASKS);
  const { wrapper } = withQueryClient();
  const { result } = await renderHook(() => useStartPractice(), { wrapper });

  await act(async () => {
    result.current.mutate({ routine: ROUTINE });
  });

  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/session/active'));
  expect(listRoutineTasksMock).toHaveBeenCalledWith('r1');
  expect(useActiveSessionStore.getState().tasks).toHaveLength(2);
});

it('toasts and stays put when the task fetch fails', async () => {
  listRoutineTasksMock.mockRejectedValue(new ApiError('', OFFLINE_STATUS));
  const { wrapper } = withQueryClient();
  const { result } = await renderHook(() => useStartPractice(), { wrapper });

  await act(async () => {
    result.current.mutate({ routine: ROUTINE });
  });

  await waitFor(() => expect(useToastStore.getState().toast).toMatchObject({ variant: 'error' }));
  // The canvas wording, not a per-screen invention.
  expect(useToastStore.getState().toast?.message).toBe('No connection');
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(useActiveSessionStore.getState().tasks).toEqual([]);
});
