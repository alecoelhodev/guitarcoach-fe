jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/routines.queries', () => ({
  useReorderRoutineTasks: jest.fn(),
  useRoutine: jest.fn(),
  useRoutineTasks: jest.fn(),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { useReorderRoutineTasks, useRoutine, useRoutineTasks } from '@/api/routines.queries';
import { RoutineDetail } from '@/features/routines/routine-detail';
import { useActiveSessionStore } from '@/features/session/session-store';
import { mockRouter } from '@/test/expo-router';
import { makeRoutine } from '@/test/fixtures';
import { errorQuery, mutationStub, pendingQuery, successQuery } from '@/test/query-hooks';
import type { RoutineTaskWithTask } from '@/types/routine';

/**
 * The only screen whose pending and error states are decided across *two* queries, which is
 * why each is driven independently: either query pending blocks the screen, and either failing
 * shows the panel with `routineQuery.error ?? tasksQuery.error`.
 */

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

const routineHook = useRoutine as unknown as AnyHook;
const tasksHook = useRoutineTasks as unknown as AnyHook;
const reorderHook = useReorderRoutineTasks as unknown as AnyHook;

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

beforeEach(() => {
  jest.clearAllMocks();
  reorderHook.mockReturnValue(mutationStub());
  ready();
});

describe('loading and failure', () => {
  it('waits for the routine', async () => {
    routineHook.mockReturnValue(pendingQuery());
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    expect(screen.queryByText('Start Practice')).toBeNull();
  });

  it('waits for the tasks even when the routine has arrived', async () => {
    tasksHook.mockReturnValue(pendingQuery());
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    expect(screen.queryByText('Morning warm-up')).toBeNull();
  });

  it('reports a failed routine fetch', async () => {
    routineHook.mockReturnValue(errorQuery(new ApiError('', 418)));
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    expect(screen.getByText("Couldn't load this routine")).toBeTruthy();
  });

  it('reports a failed task fetch with the same panel', async () => {
    tasksHook.mockReturnValue(errorQuery(new ApiError('boom', OFFLINE_STATUS)));
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    expect(screen.getByText('No connection')).toBeTruthy();
  });

  it('retries both queries from one button, since either may have failed', async () => {
    const routineQuery = errorQuery<never>(new ApiError('', 418));
    const tasksQuery = successQuery(TASKS);
    routineHook.mockReturnValue(routineQuery);
    tasksHook.mockReturnValue(tasksQuery);
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    await fireEvent.press(screen.getByText('Try again'));

    expect(routineQuery.refetch).toHaveBeenCalledTimes(1);
    expect(tasksQuery.refetch).toHaveBeenCalledTimes(1);
  });
});

describe('content', () => {
  it('lists the tasks in order, numbered', async () => {
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    expect(screen.getByText('Morning warm-up')).toBeTruthy();
    expect(screen.getByText('Alternate picking')).toBeTruthy();
    expect(screen.getByText('Modes')).toBeTruthy();
    expect(screen.getByText('3 tasks')).toBeTruthy();
  });

  it('sums only the tasks that carry a target', async () => {
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    expect(screen.getByText('25 min planned')).toBeTruthy();
    expect(screen.getByText('10 min')).toBeTruthy();
    expect(screen.getByText('15 min')).toBeTruthy();
  });

  it('omits the planned total when no task has a target', async () => {
    ready([routineTask('a', 'Alternate picking')]);
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    expect(screen.queryByText(/min planned/)).toBeNull();
    expect(screen.getByText('1 task')).toBeTruthy();
  });

  it('shows routine notes when present', async () => {
    ready(TASKS, makeRoutine({ notes: 'Metronome at 80' }));
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    expect(screen.getByText('Metronome at 80')).toBeTruthy();
  });
});

describe('reordering', () => {
  it('disables up on the first row and down on the last', async () => {
    await render(<RoutineDetail routineId={ROUTINE_ID} />);
    const buttons = screen.getAllByRole('button');

    // Two move buttons per row, in order, then Start Practice.
    expect(buttons[0]).toBeDisabled(); // first row, up
    expect(buttons[1]).not.toBeDisabled();
    expect(buttons[4]).not.toBeDisabled();
    expect(buttons[5]).toBeDisabled(); // last row, down
  });

  it('sends the whole new order when a task moves down', async () => {
    const reorder = mutationStub();
    reorderHook.mockReturnValue(reorder);
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    // Row 1's "down" button.
    await fireEvent.press(screen.getAllByRole('button')[1]);

    expect(reorder.mutate).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('sends the swapped order when a task moves up', async () => {
    const reorder = mutationStub();
    reorderHook.mockReturnValue(reorder);
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    // Row 3's "up" button.
    await fireEvent.press(screen.getAllByRole('button')[4]);

    expect(reorder.mutate).toHaveBeenCalledWith(['a', 'c', 'b']);
  });

  it('does nothing for a single-task routine, where both directions are out of bounds', async () => {
    const reorder = mutationStub();
    reorderHook.mockReturnValue(reorder);
    ready([routineTask('a', 'Only task')]);
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
    expect(reorder.mutate).not.toHaveBeenCalled();
  });
});

describe('starting practice', () => {
  it('seeds the local session from the routine and navigates to it', async () => {
    await render(<RoutineDetail routineId={ROUTINE_ID} />);

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
