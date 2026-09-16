jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: jest.fn(),
}));
jest.mock('@/api/routines.queries', () => ({
  useCreateRoutine: jest.fn(),
  useDeleteRoutine: jest.fn(),
  useRemoveRoutineTask: jest.fn(),
  useReorderRoutineTasks: jest.fn(),
  useRoutine: jest.fn(),
  useRoutineTasks: jest.fn(),
  useUpdateRoutine: jest.fn(),
  useUpdateRoutineTask: jest.fn(),
}));
// Its own suite covers seeding the session and navigating against a real QueryClient; the
// builder only has to hand it the routine plus the tasks it already holds.
jest.mock('@/features/session/use-start-practice', () => ({ useStartPractice: jest.fn() }));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { usePreventRemove } from 'expo-router/react-navigation';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import {
  useCreateRoutine,
  useDeleteRoutine,
  useRemoveRoutineTask,
  useReorderRoutineTasks,
  useRoutine,
  useRoutineTasks,
  useUpdateRoutine,
  useUpdateRoutineTask,
} from '@/api/routines.queries';
import { RoutineBuilder } from '@/features/routines/routine-builder';
import { useStartPractice } from '@/features/session/use-start-practice';
import { useToastStore } from '@/stores/toast-store';
import { linkHrefs, mockNavigation, mockRouter } from '@/test/expo-router';
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
const updateTaskHook = useUpdateRoutineTask as unknown as AnyHook;
const removeTaskHook = useRemoveRoutineTask as unknown as AnyHook;
const preventRemoveMock = usePreventRemove as jest.MockedFunction<typeof usePreventRemove>;
const useStartPracticeMock = useStartPractice as jest.MockedFunction<typeof useStartPractice>;

/** Reassigned per test so assertions can read the `mutate` the builder actually called. */
let startPractice: ReturnType<typeof mutationStub>;

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

/** Canvas 06 hides a task's controls until its row is tapped. */
const expand = (title: string) => fireEvent.press(screen.getByLabelText(title));
const creating = () => withGluestack(<RoutineBuilder />);

beforeEach(() => {
  jest.clearAllMocks();
  startPractice = mutationStub();
  (
    useStartPracticeMock as unknown as jest.MockedFunction<(...a: never[]) => unknown>
  ).mockReturnValue(startPractice);
  reorderHook.mockReturnValue(mutationStub());
  createHook.mockReturnValue(mutationStub(makeRoutine({ id: 'new-1' })));
  updateHook.mockReturnValue(mutationStub());
  deleteHook.mockReturnValue(mutationStub());
  updateTaskHook.mockReturnValue(mutationStub());
  removeTaskHook.mockReturnValue(mutationStub());
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

describe('task duration and removal', () => {
  it('keeps the controls on a row hidden until it is tapped', async () => {
    await render(editing());

    expect(screen.queryByText('Remove')).toBeNull();
    await expand('Alternate picking');

    expect(screen.getByText('Remove')).toBeTruthy();
  });

  it('expands one row at a time, so the list never becomes a wall of buttons', async () => {
    await render(editing());

    await expand('Alternate picking');
    await expand('Modes');

    // One Remove on screen means only the second row stayed open.
    expect(screen.getAllByText('Remove')).toHaveLength(1);
  });

  // A task with no target is valid; rendering it as "0 min" would claim it had one.
  it('shows an em-dash for a task with no target, not zero', async () => {
    await render(editing());

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('0 min')).toBeNull();
  });

  it('offers a starting duration for a task that has none', async () => {
    const update = mutationStub();
    updateTaskHook.mockReturnValue(update);
    await render(editing());

    await expand('Modes');
    await fireEvent.press(screen.getByText('Add duration'));

    expect(update.mutate).toHaveBeenCalledWith(
      { taskId: 'c', input: { targetDurationMinutes: 15 } },
      expect.anything(),
    );
  });

  it('steps an existing duration up', async () => {
    const update = mutationStub();
    updateTaskHook.mockReturnValue(update);
    await render(editing());

    await expand('Alternate picking');
    await fireEvent.press(screen.getByLabelText('Increase minutes'));

    expect(update.mutate).toHaveBeenCalledWith(
      { taskId: 'a', input: { targetDurationMinutes: 11 } },
      expect.anything(),
    );
  });

  /**
   * `targetDurationMinutes` is `@Min(1)` on the backend, so the stepper must never produce 0.
   * Decrementing at the floor clears instead — the field is optional by design.
   */
  it('clears rather than reaching zero at the floor', async () => {
    const update = mutationStub();
    updateTaskHook.mockReturnValue(update);
    ready([routineTask('a', 'Alternate picking', 1)]);
    await render(editing());

    await expand('Alternate picking');
    await fireEvent.press(screen.getByLabelText('Clear duration'));

    expect(update.mutate).toHaveBeenCalledWith(
      { taskId: 'a', input: { targetDurationMinutes: undefined } },
      expect.anything(),
    );
  });

  it('removes a task without asking, since re-adding it is one tap', async () => {
    const remove = mutationStub();
    removeTaskHook.mockReturnValue(remove);
    await render(editing());

    await expand('Barre chords');
    await fireEvent.press(screen.getByText('Remove'));

    expect(remove.mutate).toHaveBeenCalledWith('b', expect.anything());
    // The row collapses, so the controls do not linger over a task that is gone.
    expect(screen.queryByText('Remove')).toBeNull();
  });

  it('links to the picker for this routine', async () => {
    await render(editing());

    expect(screen.getByText('Add Tasks')).toBeTruthy();
    expect(linkHrefs).toContainEqual({
      pathname: '/routines/[id]/add-tasks',
      params: { id: ROUTINE_ID },
    });
  });
});

describe('reordering', () => {
  it('disables up on the first row and down on the last', async () => {
    await render(editing());

    await expand('Alternate picking');
    expect(screen.getByText('Move up')).toBeDisabled();
    expect(screen.getByText('Move down')).not.toBeDisabled();

    await expand('Modes');
    expect(screen.getByText('Move up')).not.toBeDisabled();
    expect(screen.getByText('Move down')).toBeDisabled();
  });

  it('sends the whole new order when a task moves down', async () => {
    const reorder = mutationStub();
    reorderHook.mockReturnValue(reorder);
    await render(editing());

    await expand('Alternate picking');
    await fireEvent.press(screen.getByText('Move down'));

    expect(reorder.mutate).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('sends the swapped order when a task moves up', async () => {
    const reorder = mutationStub();
    reorderHook.mockReturnValue(reorder);
    await render(editing());

    await expand('Modes');
    await fireEvent.press(screen.getByText('Move up'));

    expect(reorder.mutate).toHaveBeenCalledWith(['a', 'c', 'b']);
  });

  it('does nothing for a single-task routine, where both directions are out of bounds', async () => {
    const reorder = mutationStub();
    reorderHook.mockReturnValue(reorder);
    ready([routineTask('a', 'Only task')]);
    await render(editing());

    await expand('Only task');
    expect(screen.getByText('Move up')).toBeDisabled();
    expect(screen.getByText('Move down')).toBeDisabled();
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
  // The builder already holds the routine's tasks, so it passes them rather than making the
  // hook refetch what is on screen.
  it('hands the hook the routine and the tasks it already has', async () => {
    await render(editing());

    await fireEvent.press(screen.getByText('Start Practice'));

    expect(startPractice.mutate).toHaveBeenCalledWith({
      routine: { id: ROUTINE_ID, title: 'Morning warm-up' },
      tasks: TASKS,
    });
  });

  it('says it is starting while the session is being prepared', async () => {
    startPractice.isPending = true;
    await render(editing());

    expect(screen.getByText('Starting…')).toBeTruthy();
  });
});
