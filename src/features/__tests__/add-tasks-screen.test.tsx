jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/tasks.queries', () => ({ useTasks: jest.fn() }));
jest.mock('@/api/routines.queries', () => ({
  useAddRoutineTask: jest.fn(),
  useRoutineTasks: jest.fn(),
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { useAddRoutineTask, useRoutineTasks } from '@/api/routines.queries';
import { useTasks } from '@/api/tasks.queries';
import { AddTasksScreen } from '@/features/routines/add-tasks-screen';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { makePage, makeRoutineTaskWithTask, makeTask } from '@/test/fixtures';
import { infinitePages, mutationStub, successQuery } from '@/test/query-hooks';

/**
 * The library in pick mode. The backend rejects a duplicate task with a 409 and races
 * concurrent appends against `@@unique([routineId, position])`, so the two things this screen
 * owes are: never offer a task the routine already has, and add sequentially.
 */

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

const tasksHook = useTasks as unknown as AnyHook;
const routineTasksHook = useRoutineTasks as unknown as AnyHook;
const addHook = useAddRoutineTask as unknown as AnyHook;

const ROUTINE_ID = 'r1';

const LIBRARY = [
  makeTask({ id: 't1', title: 'Alternate picking' }),
  makeTask({ id: 't2', title: 'Barre chords' }),
  makeTask({ id: 't3', title: 'Modes' }),
];

function ready(inRoutine: string[] = []) {
  tasksHook.mockReturnValue(infinitePages([makePage(LIBRARY)]));
  routineTasksHook.mockReturnValue(
    successQuery(inRoutine.map((taskId) => makeRoutineTaskWithTask({ taskId }))),
  );
}

const screen_ = () => <AddTasksScreen routineId={ROUTINE_ID} />;

beforeEach(() => {
  jest.clearAllMocks();
  addHook.mockReturnValue(mutationStub());
  ready();
});

it('lists the library so tasks can be picked', async () => {
  await render(screen_());

  expect(screen.getByText('Alternate picking')).toBeTruthy();
  expect(screen.getByText('Modes')).toBeTruthy();
});

// A duplicate is a 409; the cheapest way to handle an error is not to offer it.
it('hides tasks the routine already has', async () => {
  ready(['t2']);
  await render(screen_());

  expect(screen.getByText('Alternate picking')).toBeTruthy();
  expect(screen.queryByText('Barre chords')).toBeNull();
});

it('says so when the routine already has everything', async () => {
  ready(['t1', 't2', 't3']);
  await render(screen_());

  expect(screen.getByText('Nothing left to add')).toBeTruthy();
});

it('cannot submit with nothing picked, and counts what is picked', async () => {
  await render(screen_());

  expect(screen.getByText('Add 0 tasks')).toBeDisabled();

  await fireEvent.press(screen.getByLabelText('Alternate picking'));
  expect(screen.getByText('Add 1 task')).not.toBeDisabled();

  await fireEvent.press(screen.getByLabelText('Modes'));
  expect(screen.getByText('Add 2 tasks')).toBeTruthy();
});

/**
 * Sequential, never `Promise.all`: the backend appends at `max + 1`, so concurrent adds
 * compute the same position and all but one 409.
 */
it('adds the picked tasks one at a time, in the order picked', async () => {
  const order: string[] = [];
  const add = mutationStub();
  add.mutateAsync = jest.fn(async ({ taskId }: { taskId: string }) => {
    order.push(taskId);
    return undefined;
  });
  addHook.mockReturnValue(add);
  await render(screen_());

  await fireEvent.press(screen.getByLabelText('Modes'));
  await fireEvent.press(screen.getByLabelText('Alternate picking'));
  await act(async () => {
    await fireEvent.press(screen.getByText('Add 2 tasks'));
  });

  expect(order).toEqual(['t3', 't1']);
  // `position` is omitted so the backend appends; supplying one only creates a 409 to lose.
  expect(add.mutateAsync).toHaveBeenNthCalledWith(1, { taskId: 't3' });
});

it('confirms and closes once the adds land', async () => {
  await render(screen_());

  await fireEvent.press(screen.getByLabelText('Alternate picking'));
  await act(async () => {
    await fireEvent.press(screen.getByText('Add 1 task'));
  });

  await waitFor(() =>
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Task added' }),
  );
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

// The list can go stale between render and tap, so the filter above is not the whole guard.
it('names the duplicate rather than showing a generic failure', async () => {
  const add = mutationStub();
  add.mutateAsync = jest.fn(async () => {
    throw new ApiError('already there', 409);
  });
  addHook.mockReturnValue(add);
  await render(screen_());

  await fireEvent.press(screen.getByLabelText('Alternate picking'));
  await act(async () => {
    await fireEvent.press(screen.getByText('Add 1 task'));
  });

  expect(
    screen.getByText(
      'One of those tasks is already in this routine. Change its duration there instead.',
    ),
  ).toBeTruthy();
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it('stops at the first failure and keeps what already landed', async () => {
  const add = mutationStub();
  add.mutateAsync = jest
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new ApiError('boom', OFFLINE_STATUS));
  addHook.mockReturnValue(add);
  await render(screen_());

  await fireEvent.press(screen.getByLabelText('Alternate picking'));
  await fireEvent.press(screen.getByLabelText('Modes'));
  await act(async () => {
    await fireEvent.press(screen.getByText('Add 2 tasks'));
  });

  expect(screen.getByText('No connection')).toBeTruthy();
  expect(add.mutateAsync).toHaveBeenCalledTimes(2);
  // The one that landed is dropped from the selection — retrying it would only 409.
  expect(screen.getByText('Add 1 task')).toBeTruthy();
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it('closes without adding anything when cancelled', async () => {
  await render(screen_());

  await fireEvent.press(screen.getByText('Cancel'));

  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
