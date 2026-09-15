jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/routines.queries', () => ({
  useFetchRoutineTasks: jest.fn(),
  useUpdateRoutine: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { useFetchRoutineTasks, useUpdateRoutine } from '@/api/routines.queries';
import { PlanPreviewCard } from '@/features/coach/plan-preview-card';
import { SessionCard } from '@/features/history/session-card';
import { TaskCard } from '@/features/library/task-card';
import { RoutineCard } from '@/features/routines/routine-card';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useToastStore } from '@/stores/toast-store';
import { linkHrefs, mockRouter } from '@/test/expo-router';
import {
  makeRoutine,
  makeRoutineTaskWithTask,
  makeSession,
  makeSessionTask,
  makeTask,
} from '@/test/fixtures';
import { mutationStub } from '@/test/query-hooks';
import type { PracticePlan } from '@/types/coach';

const useFetchRoutineTasksMock = useFetchRoutineTasks as jest.MockedFunction<
  typeof useFetchRoutineTasks
>;
const useUpdateRoutineMock = useUpdateRoutine as jest.MockedFunction<typeof useUpdateRoutine>;

// The hooks are typed against TanStack's full result; the card reads only a slice of it.
type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

/** Hands the card a resolved task list and reports what it was asked for. */
function stubRoutineTasks(tasks = [makeRoutineTaskWithTask()]) {
  const fetchTasks = jest.fn(async () => tasks);
  useFetchRoutineTasksMock.mockReturnValue(fetchTasks);
  return fetchTasks;
}

beforeEach(() => {
  stubRoutineTasks();
  (useUpdateRoutineMock as unknown as AnyHook).mockReturnValue(mutationStub());
});

/**
 * The four list-row cards. Each one is a stack of independent optional-field branches, so
 * every test here renders one shape and asserts what is and is not on screen — the "is not"
 * half being the point, since an unconditionally-rendered badge looks fine in isolation.
 *
 * All four are `<Link asChild>`, so the shared router mock also enforces the array-style rule
 * that expo-router's real Slot throws on in development.
 */

describe('RoutineCard', () => {
  it('links to the routine detail route with the id as a param', async () => {
    await render(<RoutineCard routine={makeRoutine({ id: 'r7' })} />);

    expect(linkHrefs).toEqual([{ pathname: '/routines/[id]', params: { id: 'r7' } }]);
  });

  it('leaves an active routine unbadged', async () => {
    await render(<RoutineCard routine={makeRoutine({ title: 'Morning warm-up' })} />);

    expect(screen.getByText('Morning warm-up')).toBeTruthy();
    expect(screen.queryByText('Archived')).toBeNull();
  });

  it('badges an archived routine', async () => {
    await render(<RoutineCard routine={makeRoutine({ status: 'archived' })} />);

    expect(screen.getByText('Archived')).toBeTruthy();
  });

  it('offers Start Practice on an active routine and no restore', async () => {
    await render(<RoutineCard routine={makeRoutine({ status: 'active' })} />);

    expect(screen.getByText('Start Practice')).toBeTruthy();
    expect(screen.queryByText('Restore to active')).toBeNull();
  });

  // Canvas 05b: archived routines are reviewable and restorable, never startable.
  it('offers Restore to active on an archived routine and no Start Practice', async () => {
    await render(<RoutineCard routine={makeRoutine({ status: 'archived' })} />);

    expect(screen.getByText('Restore to active')).toBeTruthy();
    expect(screen.queryByText('Start Practice')).toBeNull();
  });

  /**
   * A list card carries no task data, so Start has to fetch the routine's tasks before it can
   * seed the session. The whole point of doing it on press is that nothing is requested for
   * the routines the user never starts.
   */
  it('fetches the routine tasks on press, then seeds the session and navigates', async () => {
    const fetchTasks = stubRoutineTasks([
      makeRoutineTaskWithTask({ taskId: 't1', targetDurationMinutes: 10 }),
    ]);
    await render(<RoutineCard routine={makeRoutine({ id: 'r3', title: 'Morning warm-up' })} />);

    expect(fetchTasks).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Start Practice'));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/session/active'));
    expect(fetchTasks).toHaveBeenCalledWith('r3');
    expect(useActiveSessionStore.getState()).toMatchObject({
      routineId: 'r3',
      title: 'Morning warm-up',
      tasks: [{ taskId: 't1', durationMinutes: 10, completed: false }],
    });
  });

  it('toasts rather than opening an empty session when the task fetch fails', async () => {
    useFetchRoutineTasksMock.mockReturnValue(
      jest.fn(async () => {
        throw new ApiError('boom', 500);
      }),
    );
    await render(<RoutineCard routine={makeRoutine()} />);

    await fireEvent.press(screen.getByText('Start Practice'));

    await waitFor(() =>
      expect(useToastStore.getState().toast).toEqual({
        message: 'Something went wrong on our end',
        variant: 'error',
      }),
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('restores an archived routine by patching it back to active', async () => {
    const restore = mutationStub();
    (useUpdateRoutineMock as unknown as AnyHook).mockReturnValue(restore);
    await render(<RoutineCard routine={makeRoutine({ id: 'r4', status: 'archived' })} />);

    await fireEvent.press(screen.getByText('Restore to active'));

    expect(useUpdateRoutineMock).toHaveBeenCalledWith('r4');
    expect(restore.mutate).toHaveBeenCalledWith({ status: 'active' }, expect.anything());
  });

  it('shows notes only when the routine has them', async () => {
    const without = await render(<RoutineCard routine={makeRoutine()} />);
    expect(screen.queryByText('Focus on the B string')).toBeNull();
    await without.unmount();

    await render(<RoutineCard routine={makeRoutine({ notes: 'Focus on the B string' })} />);

    expect(screen.getByText('Focus on the B string')).toBeTruthy();
  });
});

describe('TaskCard', () => {
  it('links to the library detail route', async () => {
    await render(<TaskCard task={makeTask({ id: 't9' })} />);

    expect(linkHrefs).toEqual([{ pathname: '/library/[id]', params: { id: 't9' } }]);
  });

  it('renders a bare task with none of its optional decorations', async () => {
    await render(<TaskCard task={makeTask({ title: 'Alternate picking' })} />);

    expect(screen.getByText('Alternate picking')).toBeTruthy();
    expect(screen.queryByText('technique')).toBeNull();
    expect(screen.queryByText('easy')).toBeNull();
    expect(screen.queryByText('Link')).toBeNull();
  });

  it('badges category and difficulty independently', async () => {
    const categoryOnly = await render(<TaskCard task={makeTask({ category: 'theory' })} />);
    expect(screen.getByText('theory')).toBeTruthy();
    expect(screen.queryByText('hard')).toBeNull();
    await categoryOnly.unmount();

    await render(<TaskCard task={makeTask({ difficulty: 'hard' })} />);

    expect(screen.getByText('hard')).toBeTruthy();
    expect(screen.queryByText('theory')).toBeNull();
  });

  it('marks a task that carries a reference link', async () => {
    await render(<TaskCard task={makeTask({ referenceLink: 'https://example.com' })} />);

    expect(screen.getByText('Link')).toBeTruthy();
  });

  it('shows the description when present', async () => {
    await render(<TaskCard task={makeTask({ description: 'Down-up at 80bpm' })} />);

    expect(screen.getByText('Down-up at 80bpm')).toBeTruthy();
  });
});

describe('SessionCard', () => {
  it('links to the history detail route', async () => {
    await render(<SessionCard session={makeSession({ id: 's3' })} />);

    expect(linkHrefs).toEqual([{ pathname: '/history/[id]', params: { id: 's3' } }]);
  });

  it('falls back to a generic title, since sessions need not be named', async () => {
    await render(<SessionCard session={makeSession()} />);

    expect(screen.getByText('Practice session')).toBeTruthy();
  });

  it('uses the session title when it has one', async () => {
    await render(<SessionCard session={makeSession({ title: 'Blues in A' })} />);

    expect(screen.getByText('Blues in A')).toBeTruthy();
    expect(screen.queryByText('Practice session')).toBeNull();
  });

  it('omits both badges for a session with no tasks at all', async () => {
    await render(<SessionCard session={makeSession({ sessionTasks: [] })} />);

    expect(screen.queryByText(/min|of/)).toBeNull();
  });

  it('shows the minutes badge only once some task carries minutes', async () => {
    const noMinutes = await render(
      <SessionCard
        session={makeSession({ sessionTasks: [makeSessionTask({ completed: true })] })}
      />,
    );
    expect(screen.queryByText('0 min')).toBeNull();
    expect(screen.getByText('1 of 1 done')).toBeTruthy();
    await noMinutes.unmount();

    await render(
      <SessionCard
        session={makeSession({
          sessionTasks: [
            makeSessionTask({ taskId: 'a', durationMinutes: 20, completed: true }),
            makeSessionTask({ taskId: 'b', durationMinutes: 25 }),
          ],
        })}
      />,
    );

    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText('1 of 2 done')).toBeTruthy();
  });

  it('shows notes when present', async () => {
    await render(<SessionCard session={makeSession({ notes: 'Felt sloppy' })} />);

    expect(screen.getByText('Felt sloppy')).toBeTruthy();
  });
});

describe('PlanPreviewCard', () => {
  function makePlan(overrides: Partial<PracticePlan> = {}): PracticePlan {
    return {
      title: 'Blues warm-up',
      summary: 'Shuffle feel and turnarounds.',
      totalDurationMinutes: 30,
      tasks: [
        { title: 'Shuffle rhythm', durationMinutes: 15 },
        { title: 'Turnarounds', durationMinutes: 15 },
      ],
      ...overrides,
    } as PracticePlan;
  }

  it('says nothing is saved yet, which is the whole point of Draft & Review', async () => {
    await render(<PlanPreviewCard plan={makePlan()} onConfirm={jest.fn()} onDecline={jest.fn()} />);

    expect(screen.getByText('Not saved')).toBeTruthy();
    expect(screen.getByText('Draft plan')).toBeTruthy();
  });

  it('lists the plan, its total and each numbered task', async () => {
    await render(<PlanPreviewCard plan={makePlan()} onConfirm={jest.fn()} onDecline={jest.fn()} />);

    expect(screen.getByText('Blues warm-up')).toBeTruthy();
    expect(screen.getByText('Shuffle feel and turnarounds.')).toBeTruthy();
    expect(screen.getByText('30 min total')).toBeTruthy();
    expect(screen.getByText('2 tasks')).toBeTruthy();
    expect(screen.getByText('Shuffle rhythm')).toBeTruthy();
    expect(screen.getByText('Turnarounds')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('says "task" rather than "tasks" for a single-task plan', async () => {
    await render(
      <PlanPreviewCard
        plan={makePlan({ tasks: [{ title: 'Only one', durationMinutes: 10 }] as never })}
        onConfirm={jest.fn()}
        onDecline={jest.fn()}
      />,
    );

    expect(screen.getByText('1 task')).toBeTruthy();
  });

  it('wires save and discard to their own handlers', async () => {
    const onConfirm = jest.fn();
    const onDecline = jest.fn();
    await render(<PlanPreviewCard plan={makePlan()} onConfirm={onConfirm} onDecline={onDecline} />);

    await fireEvent.press(screen.getByText('Save Routine'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Discard'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('blocks both actions while a resolve is in flight', async () => {
    const onConfirm = jest.fn();
    const onDecline = jest.fn();
    await render(
      <PlanPreviewCard plan={makePlan()} loading onConfirm={onConfirm} onDecline={onDecline} />,
    );

    await fireEvent.press(screen.getByText('Save Routine'));
    await fireEvent.press(screen.getByText('Discard'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDecline).not.toHaveBeenCalled();
  });
});
