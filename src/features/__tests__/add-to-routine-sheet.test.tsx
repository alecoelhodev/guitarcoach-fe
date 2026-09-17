jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
jest.mock('@/api/routines.queries', () => ({
  useRoutines: jest.fn(),
  useAddRoutineTask: jest.fn(),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { useAddRoutineTask, useRoutines } from '@/api/routines.queries';
import { AddToRoutineSheet } from '@/features/library/add-to-routine-sheet';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { makePage, makeRoutine } from '@/test/fixtures';
import { infinitePages, mutationStub } from '@/test/query-hooks';

/**
 * Canvas 04's add sheet. The 409 is the case worth the most care: `@@id([routineId, taskId])`
 * makes a task unique per routine, so "already in that routine" is a designed state telling the
 * user where the task is — not a failure to retry.
 */

const useRoutinesMock = useRoutines as jest.MockedFunction<typeof useRoutines>;
const useAddRoutineTaskMock = useAddRoutineTask as jest.MockedFunction<typeof useAddRoutineTask>;

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

const ROUTINES = [
  makeRoutine({ id: 'r1', title: 'Morning warm-up', taskCount: 4 }),
  makeRoutine({ id: 'r2', title: 'Fingerstyle focus', taskCount: 1 }),
];

let addTask: ReturnType<typeof mutationStub>;
const onClose = jest.fn();

function renderSheet() {
  return render(<AddToRoutineSheet taskId="task-1" onClose={onClose} />);
}

/** The sheet only enables Add once a routine is picked. */
async function pick(title: string) {
  await fireEvent.press(screen.getByLabelText(title));
}

beforeEach(() => {
  jest.clearAllMocks();
  addTask = mutationStub();
  (useAddRoutineTaskMock as unknown as AnyHook).mockReturnValue(addTask);
  (useRoutinesMock as unknown as AnyHook).mockReturnValue(
    infinitePages([makePage(ROUTINES, { total: 18 })]),
  );
});

it('lists active routines with their task counts, and the active total', async () => {
  await renderSheet();

  expect(useRoutinesMock).toHaveBeenCalledWith({ status: 'active' });
  expect(screen.getByText('18 active')).toBeTruthy();
  expect(screen.getByText('4 tasks')).toBeTruthy();
  // Singular, not "1 tasks".
  expect(screen.getByText('1 task')).toBeTruthy();
});

it('will not add anything until a routine is picked', async () => {
  await renderSheet();

  expect(screen.getByText('Add task')).toBeDisabled();

  await pick('Fingerstyle focus');

  expect(screen.getByText('Add task')).not.toBeDisabled();
});

it('adds the task with the prefilled duration and closes', async () => {
  await renderSheet();
  await pick('Fingerstyle focus');

  await act(async () => {
    await fireEvent.press(screen.getByText('Add task'));
  });

  expect(useAddRoutineTaskMock).toHaveBeenCalledWith('r2');
  expect(addTask.mutateAsync).toHaveBeenCalledWith({
    taskId: 'task-1',
    targetDurationMinutes: 15,
  });
  expect(useToastStore.getState().toast).toMatchObject({
    message: 'Added to Fingerstyle focus',
    variant: 'success',
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

/**
 * `targetDurationMinutes` is optional and `@Min(1)`. Clearing it must omit the key, never send
 * a zero — the same trap that made every Finish a 400 before spec 08.
 */
it('omits the duration entirely once it is cleared', async () => {
  await renderSheet();
  await pick('Fingerstyle focus');

  // 15 down to the floor of 1, where the decrement relabels itself and clears instead of
  // dead-ending — which is how the value goes away without the stepper ever reaching 0.
  for (let i = 0; i < 14; i += 1) {
    await fireEvent.press(screen.getByLabelText('Decrease minutes'));
  }
  await fireEvent.press(screen.getByLabelText('Clear duration'));

  await act(async () => {
    await fireEvent.press(screen.getByText('Add task'));
  });

  expect(addTask.mutateAsync).toHaveBeenCalledWith({ taskId: 'task-1' });
});

it('names the routine the task is already in, and offers no retry', async () => {
  addTask.mutateAsync = jest.fn(async () => {
    throw new ApiError('Conflict', 409);
  });
  await renderSheet();
  await pick('Fingerstyle focus');

  await act(async () => {
    await fireEvent.press(screen.getByText('Add task'));
  });

  expect(
    screen.getByText(
      'This task is already in Fingerstyle focus. Change its duration there instead.',
    ),
  ).toBeTruthy();
  // Retrying would produce the same 409; the fix is on the routine, which the copy points at.
  expect(screen.queryByText('Try again')).toBeNull();
  // The sheet stays open so the user can pick a different routine.
  expect(onClose).not.toHaveBeenCalled();
});

it('offers a retry on a real failure, and keeps the sheet open', async () => {
  addTask.mutateAsync = jest.fn(async () => {
    throw new ApiError('boom', OFFLINE_STATUS);
  });
  await renderSheet();
  await pick('Fingerstyle focus');

  await act(async () => {
    await fireEvent.press(screen.getByText('Add task'));
  });

  expect(screen.getByText('No connection')).toBeTruthy();
  expect(screen.getByText('Try again')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});

it('clears a conflict when a different routine is picked', async () => {
  addTask.mutateAsync = jest.fn(async () => {
    throw new ApiError('Conflict', 409);
  });
  await renderSheet();
  await pick('Fingerstyle focus');
  await act(async () => {
    await fireEvent.press(screen.getByText('Add task'));
  });

  await pick('Morning warm-up');

  expect(screen.queryByText(/already in/)).toBeNull();
});

it('sends the user to the builder when no routine fits', async () => {
  await renderSheet();

  await fireEvent.press(screen.getByText('New routine instead'));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith('/routines/new');
});

it('says so when there is no active routine to add to', async () => {
  (useRoutinesMock as unknown as AnyHook).mockReturnValue(infinitePages([makePage([])]));
  await renderSheet();

  expect(screen.getByText('No active routines')).toBeTruthy();
  expect(screen.getByText('New routine instead')).toBeTruthy();
});
