jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: jest.fn(),
}));
jest.mock('@/api/routines.queries', () => ({
  useCreateRoutine: jest.fn(),
  useDeleteRoutine: jest.fn(),
  useReorderRoutineTasks: jest.fn(),
  useRoutine: jest.fn(),
  useRoutineTasks: jest.fn(),
  useUpdateRoutine: jest.fn(),
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { usePreventRemove } from 'expo-router/react-navigation';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import {
  useCreateRoutine,
  useDeleteRoutine,
  useReorderRoutineTasks,
  useRoutine,
  useRoutineTasks,
  useUpdateRoutine,
} from '@/api/routines.queries';
import { RoutineBuilder } from '@/features/routines/routine-builder';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useToastStore } from '@/stores/toast-store';
import { mockNavigation, mockRouter } from '@/test/expo-router';
import { makeRoutine } from '@/test/fixtures';
import { withGluestack } from '@/test/gluestack';
import { errorQuery, mutationStub, pendingQuery, successQuery } from '@/test/query-hooks';
import type { RoutineTaskWithTask } from '@/types/routine';

/**
 * One screen, two modes. Edit mode is the only screen whose pending and error states are
 * decided across *two* queries, which is why each is driven independently: either query
 * pending blocks the screen, and either failing shows the panel with
 * `routineQuery.error ?? tasksQuery.error`.
 *
 * Every render goes through `withGluestack` — `ConfirmDialog` and `UnsavedChangesDialog`
 * portal through `OverlayProvider`, and without one they render *nothing*, so a
 * "the dialog is closed" assertion would pass for the wrong reason.
 */

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

const routineHook = useRoutine as unknown as AnyHook;
const tasksHook = useRoutineTasks as unknown as AnyHook;
const reorderHook = useReorderRoutineTasks as unknown as AnyHook;
const createHook = useCreateRoutine as unknown as AnyHook;
const updateHook = useUpdateRoutine as unknown as AnyHook;
const deleteHook = useDeleteRoutine as unknown as AnyHook;
const preventRemoveMock = usePreventRemove as jest.MockedFunction<typeof usePreventRemove>;

const ROUTINE_ID = 'r1';

function routineTask(taskId: string, title: string, minutes?: number): RoutineTaskWithTask {
  return {
    taskId,
    targetDurationMinutes: minutes ?? null,
    task: { id: taskId, title },
  } as unknown as RoutineTaskWithTask;
}

const TASKS = [
  routineTask('a', 'Alternate picking', 10),
  routineTask('b', 'Barre chords', 15),
  routineTask('c', 'Modes'),
];

function ready(tasks = TASKS, routine = makeRoutine({ title: 'Morning warm-up' })) {
  routineHook.mockReturnValue(successQuery(routine));
  tasksHook.mockReturnValue(successQuery(tasks));
}

/**
 * Runs the guard's callback as if the user had tried to leave with the form dirty. The real
 * hook is mocked, so the last call's callback *is* what expo-router would have invoked — it
 * just has to run inside `act` for the resulting dialog to be rendered before we assert.
 */
async function triggerLeave() {
  const [preventRemove, callback] = preventRemoveMock.mock.calls.at(-1) ?? [];
  expect(preventRemove).toBe(true);
  await act(async () => {
    callback?.({ data: { action: BLOCKED_ACTION } });
  });
}

const BLOCKED_ACTION = { type: 'POP' } as Parameters<
  Parameters<typeof usePreventRemove>[1]
>[0]['data']['action'];

const editing = () => withGluestack(<RoutineBuilder routineId={ROUTINE_ID} />);
const creating = () => withGluestack(<RoutineBuilder />);

beforeEach(() => {
  jest.clearAllMocks();
  reorderHook.mockReturnValue(mutationStub());
  createHook.mockReturnValue(mutationStub(makeRoutine({ id: 'new-1' })));
  updateHook.mockReturnValue(mutationStub());
  deleteHook.mockReturnValue(mutationStub());
  ready();
});

describe('loading and failure', () => {
  it('waits for the routine', async () => {
    routineHook.mockReturnValue(pendingQuery());
    await render(editing());

    expect(screen.queryByText('Start Practice')).toBeNull();
  });

  it('waits for the tasks even when the routine has arrived', async () => {
    tasksHook.mockReturnValue(pendingQuery());
    await render(editing());

    expect(screen.queryByText('Start Practice')).toBeNull();
  });

  it('reports a failed routine fetch', async () => {
    routineHook.mockReturnValue(errorQuery(new ApiError('', 418)));
    await render(editing());

    expect(screen.getByText("Couldn't load this routine")).toBeTruthy();
  });

  it('reports a failed task fetch with the same panel', async () => {
    tasksHook.mockReturnValue(errorQuery(new ApiError('boom', OFFLINE_STATUS)));
    await render(editing());

    expect(screen.getByText('No connection')).toBeTruthy();
  });

  it('retries both queries from one button, since either may have failed', async () => {
    const routineQuery = errorQuery<never>(new ApiError('', 418));
    const tasksQuery = successQuery(TASKS);
    routineHook.mockReturnValue(routineQuery);
    tasksHook.mockReturnValue(tasksQuery);
    await render(editing());

    await fireEvent.press(screen.getByText('Try again'));

    expect(routineQuery.refetch).toHaveBeenCalledTimes(1);
    expect(tasksQuery.refetch).toHaveBeenCalledTimes(1);
  });

  // Create mode has nothing to fetch, so it must not sit behind either query.
  it('renders the create form without waiting on any query', async () => {
    routineHook.mockReturnValue(pendingQuery());
    tasksHook.mockReturnValue(pendingQuery());
    await render(creating());

    expect(screen.getByTestId('routine-title')).toBeTruthy();
  });
});

describe('content', () => {
  it('lists the tasks in order, numbered', async () => {
    await render(editing());

    expect(screen.getByText('Alternate picking')).toBeTruthy();
    expect(screen.getByText('Modes')).toBeTruthy();
    expect(screen.getByText('3 tasks')).toBeTruthy();
  });

  it('seeds the fields from the routine rather than rendering them empty', async () => {
    ready(TASKS, makeRoutine({ title: 'Morning warm-up', notes: 'Metronome at 80' }));
    await render(editing());

    expect(screen.getByTestId('routine-title').props.value).toBe('Morning warm-up');
    expect(screen.getByTestId('routine-notes').props.value).toBe('Metronome at 80');
  });

  it('sums only the tasks that carry a target', async () => {
    await render(editing());

    expect(screen.getByText('25 min planned')).toBeTruthy();
    expect(screen.getByText('10 min')).toBeTruthy();
  });

  it('omits the planned total when no task has a target', async () => {
    ready([routineTask('a', 'Alternate picking')]);
    await render(editing());

    expect(screen.queryByText(/min planned/)).toBeNull();
    expect(screen.getByText('1 task')).toBeTruthy();
  });

  // A routine has to exist before POST /routines/{id}/tasks can attach anything to it.
  it('tells the user to save before adding tasks, rather than showing a dead control', async () => {
    await render(creating());

    expect(screen.getByText('Save the routine first, then add tasks to it.')).toBeTruthy();
    expect(screen.queryByText('Start Practice')).toBeNull();
  });
});

describe('creating', () => {
  it('rejects a one-character title client-side, without a request', async () => {
    const create = mutationStub(makeRoutine());
    createHook.mockReturnValue(create);
    await render(creating());

    await fireEvent.changeText(screen.getByTestId('routine-title'), 'x');
    await fireEvent.press(screen.getByText('Save'));

    expect(await screen.findByText('Give the routine a title before saving.')).toBeTruthy();
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('creates the routine and replaces onto it, so back reaches the list', async () => {
    const create = mutationStub(makeRoutine({ id: 'new-1' }));
    createHook.mockReturnValue(create);
    await render(creating());

    await fireEvent.changeText(screen.getByTestId('routine-title'), '  Evening theory  ');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() =>
      expect(create.mutateAsync).toHaveBeenCalledWith({
        title: 'Evening theory',
        notes: undefined,
      }),
    );
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/routines/[id]',
      params: { id: 'new-1' },
    });
  });

  it('surfaces a failed create instead of navigating', async () => {
    const create = mutationStub();
    create.mutateAsync = jest.fn(async () => {
      throw new ApiError('boom', OFFLINE_STATUS);
    });
    createHook.mockReturnValue(create);
    await render(creating());

    await fireEvent.changeText(screen.getByTestId('routine-title'), 'Evening theory');
    await fireEvent.press(screen.getByText('Save'));

    expect(await screen.findByText('No connection')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('editing', () => {
  it('badges the form as unsaved once a field changes, and not before', async () => {
    await render(editing());
    expect(screen.queryByText('Unsaved')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('routine-title'), 'Evening theory');

    expect(screen.getByText('Unsaved')).toBeTruthy();
  });

  // PATCH takes a partial body, so an untouched field must not be sent back.
  it('sends only the fields that actually changed', async () => {
    const update = mutationStub();
    updateHook.mockReturnValue(update);
    ready(TASKS, makeRoutine({ title: 'Morning warm-up', notes: 'Metronome at 80' }));
    await render(editing());

    await fireEvent.changeText(screen.getByTestId('routine-title'), 'Evening theory');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() =>
      expect(update.mutateAsync).toHaveBeenCalledWith({ title: 'Evening theory' }),
    );
  });

  it('sends the status when only the segment moved', async () => {
    const update = mutationStub();
    updateHook.mockReturnValue(update);
    await render(editing());

    await fireEvent.press(screen.getByRole('button', { name: 'Archived' }));
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledWith({ status: 'archived' }));
  });

  it('confirms the save with a toast and drops the unsaved badge', async () => {
    await render(editing());

    await fireEvent.changeText(screen.getByTestId('routine-title'), 'Evening theory');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() =>
      expect(useToastStore.getState().toast).toEqual({
        message: 'Routine saved',
        variant: 'success',
      }),
    );
    expect(screen.queryByText('Unsaved')).toBeNull();
  });

  it('archives without deleting, since archive is not destructive', async () => {
    const update = mutationStub();
    updateHook.mockReturnValue(update);
    await render(editing());

    await fireEvent.press(screen.getByText('Archive'));

    await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledWith({ status: 'archived' }));
    expect(deleteHook).toHaveBeenCalled();
  });
});

describe('deleting', () => {
  // DELETE is a 409 while any task is attached, so the action states its precondition rather
  // than cascading — a cascade that fails partway strips the tasks and still does not delete.
  it('refuses to offer delete while the routine still has tasks', async () => {
    ready(TASKS, makeRoutine({ taskCount: 3 }));
    await render(editing());

    expect(screen.getByText('Delete')).toBeDisabled();
    expect(screen.getByText("Remove this routine's tasks before deleting it.")).toBeTruthy();
  });

  it('offers delete on an empty routine, behind a confirmation', async () => {
    const remove = mutationStub();
    deleteHook.mockReturnValue(remove);
    ready([], makeRoutine({ taskCount: 0, title: 'Old rotation' }));
    await render(editing());

    await fireEvent.press(screen.getByText('Delete'));

    expect(screen.getByText('Delete "Old rotation"?')).toBeTruthy();
    expect(remove.mutateAsync).not.toHaveBeenCalled();
  });

  it('deletes and leaves for the list once confirmed', async () => {
    const remove = mutationStub();
    deleteHook.mockReturnValue(remove);
    ready([], makeRoutine({ taskCount: 0 }));
    await render(editing());

    await fireEvent.press(screen.getByText('Delete'));
    await fireEvent.press(screen.getAllByText('Delete').at(-1) as never);

    await waitFor(() => expect(remove.mutateAsync).toHaveBeenCalledWith(ROUTINE_ID));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(main)/(tabs)/routines');
  });
});

describe('unsaved-changes guard', () => {
  it('does not block navigation while the form is untouched', async () => {
    await render(editing());

    expect(preventRemoveMock.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it('blocks once the form is dirty', async () => {
    await render(editing());

    await fireEvent.changeText(screen.getByTestId('routine-title'), 'Evening theory');

    expect(preventRemoveMock.mock.calls.at(-1)?.[0]).toBe(true);
  });

  it('asks before leaving, and Keep editing stays put', async () => {
    await render(editing());
    await fireEvent.changeText(screen.getByTestId('routine-title'), 'Evening theory');

    await triggerLeave();
    expect(await screen.findByText('Save changes to this routine?')).toBeTruthy();

    await fireEvent.press(screen.getByText('Keep editing'));

    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  });

  it('Discard resumes the navigation the guard interrupted', async () => {
    await render(editing());
    await fireEvent.changeText(screen.getByTestId('routine-title'), 'Evening theory');

    await triggerLeave();
    await fireEvent.press(screen.getByText('Discard'));

    expect(mockNavigation.dispatch).toHaveBeenCalledWith(BLOCKED_ACTION);
  });

  it('Save writes first, then resumes', async () => {
    const update = mutationStub();
    updateHook.mockReturnValue(update);
    await render(editing());
    await fireEvent.changeText(screen.getByTestId('routine-title'), 'Evening theory');

    await triggerLeave();
    await fireEvent.press(screen.getAllByText('Save').at(-1) as never);

    await waitFor(() => expect(mockNavigation.dispatch).toHaveBeenCalledWith(BLOCKED_ACTION));
    expect(update.mutateAsync).toHaveBeenCalledWith({ title: 'Evening theory' });
  });

  it('stays put when the save that would let it leave fails', async () => {
    const update = mutationStub();
    update.mutateAsync = jest.fn(async () => {
      throw new ApiError('boom', OFFLINE_STATUS);
    });
    updateHook.mockReturnValue(update);
    await render(editing());
    await fireEvent.changeText(screen.getByTestId('routine-title'), 'Evening theory');

    await triggerLeave();
    await fireEvent.press(screen.getAllByText('Save').at(-1) as never);

    await waitFor(() => expect(screen.getByText('No connection')).toBeTruthy());
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  });
});

describe('reordering', () => {
  it('disables up on the first row and down on the last', async () => {
    await render(editing());

    expect(screen.getByLabelText('Move Alternate picking up')).toBeDisabled();
    expect(screen.getByLabelText('Move Alternate picking down')).not.toBeDisabled();
    expect(screen.getByLabelText('Move Modes up')).not.toBeDisabled();
    expect(screen.getByLabelText('Move Modes down')).toBeDisabled();
  });

  it('sends the whole new order when a task moves down', async () => {
    const reorder = mutationStub();
    reorderHook.mockReturnValue(reorder);
    await render(editing());

    await fireEvent.press(screen.getByLabelText('Move Alternate picking down'));

    expect(reorder.mutate).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('sends the swapped order when a task moves up', async () => {
    const reorder = mutationStub();
    reorderHook.mockReturnValue(reorder);
    await render(editing());

    await fireEvent.press(screen.getByLabelText('Move Modes up'));

    expect(reorder.mutate).toHaveBeenCalledWith(['a', 'c', 'b']);
  });

  it('does nothing for a single-task routine, where both directions are out of bounds', async () => {
    const reorder = mutationStub();
    reorderHook.mockReturnValue(reorder);
    ready([routineTask('a', 'Only task')]);
    await render(editing());

    expect(screen.getByLabelText('Move Only task up')).toBeDisabled();
    expect(screen.getByLabelText('Move Only task down')).toBeDisabled();
    expect(reorder.mutate).not.toHaveBeenCalled();
  });

  // Canvas 06b: the reorder lock is per-routine, so a concurrent change loses the race and
  // the optimistic order has already rolled back underneath the user.
  it('names the lost race rather than failing silently', async () => {
    reorderHook.mockReturnValue({ ...mutationStub(), isError: true });
    await render(editing());

    expect(screen.getByText('Order not saved')).toBeTruthy();
    expect(
      screen.getByText('Another change was in progress. The list is back to the last saved order.'),
    ).toBeTruthy();
  });
});

describe('starting practice', () => {
  it('seeds the local session from the routine and navigates to it', async () => {
    await render(editing());

    await fireEvent.press(screen.getByText('Start Practice'));

    expect(useActiveSessionStore.getState()).toMatchObject({
      routineId: ROUTINE_ID,
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
          taskId: 'b',
          title: 'Barre chords',
          targetDurationMinutes: 15,
          durationMinutes: 15,
          completed: false,
        },
        // No target, so minutes start at 0 rather than undefined — the Stepper needs a number.
        {
          taskId: 'c',
          title: 'Modes',
          targetDurationMinutes: undefined,
          durationMinutes: 0,
          completed: false,
        },
      ],
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/session/active');
  });
});
