jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/sessions.queries', () => ({ useCreateSession: jest.fn() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { useCreateSession } from '@/api/sessions.queries';
import { ActiveSessionScreen } from '@/features/session/active-session-screen';
import { useActiveSessionStore } from '@/features/session/session-store';
import { storage } from '@/lib/storage';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { withGluestack } from '@/test/gluestack';
import { mutationStub } from '@/test/query-hooks';

/**
 * Wrapped in `withGluestack` throughout, because the exit confirmation is a Gluestack overlay
 * and renders nothing without a provider to portal into.
 *
 * Fake timers throughout too: `useStopwatch` ticks a `setInterval` every second, so on real
 * timers the clock advances mid-test and keeps running after teardown.
 */

const useCreateSessionMock = useCreateSession as unknown as jest.MockedFunction<
  (...args: never[]) => unknown
>;

function startSession(tasks = [{ taskId: 't1', title: 'Alternate picking' }]) {
  useActiveSessionStore.getState().start({
    routineId: 'r1',
    title: 'Morning warm-up',
    tasks: tasks.map((t) => ({
      targetDurationMinutes: 10,
      durationMinutes: 10,
      completed: false,
      ...t,
    })),
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useCreateSessionMock.mockReturnValue(mutationStub());
});

afterEach(() => jest.useRealTimers());

describe('with no active session', () => {
  it('offers a way back instead of an empty stopwatch', async () => {
    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('No active session')).toBeTruthy();
    expect(screen.queryByText('Finish Session')).toBeNull();

    await fireEvent.press(screen.getByText('Go back'));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('stays on the empty screen even if a session starts mid-render', async () => {
    await render(withGluestack(<ActiveSessionScreen />));

    // `startedWithNoTasks` is a lazy `useState` initialiser, so it is decided once at mount.
    await act(async () => startSession());

    expect(screen.getByText('No active session')).toBeTruthy();
  });
});

describe('restored from a previous launch', () => {
  /**
   * The cold-start ordering that the hydration gate exists for: `persist` reads AsyncStorage
   * asynchronously, so the store is still empty when the screen first mounts. Without the
   * gate the body would mount on that empty render and `startedWithNoTasks` — a lazy
   * `useState` initialiser, decided once — would latch "no session" for good, hiding a
   * session that is sitting on disk.
   */
  it('shows the persisted session instead of latching the empty state', async () => {
    await storage.setItem(
      'active-session',
      JSON.stringify({
        version: 0,
        state: {
          routineId: 'r1',
          title: 'Morning warm-up',
          tasks: [
            {
              taskId: 't1',
              title: 'Alternate picking',
              targetDurationMinutes: 10,
              durationMinutes: 10,
              completed: false,
            },
          ],
        },
      }),
    );
    // Deliberately not awaited: `rehydrate()` flips `hasHydrated` to false synchronously and
    // settles later, which is exactly the ordering a cold start produces.
    const rehydrated = useActiveSessionStore.persist.rehydrate();

    await render(withGluestack(<ActiveSessionScreen />));
    await act(async () => {
      await rehydrated;
    });

    expect(screen.getByText('Following · Morning warm-up')).toBeTruthy();
    expect(screen.getByText('Alternate picking')).toBeTruthy();
    expect(screen.queryByText('No active session')).toBeNull();
  });
});

describe('with an active session', () => {
  it('names the routine being followed', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('Following · Morning warm-up')).toBeTruthy();
    expect(screen.getByText('Morning warm-up')).toBeTruthy();
  });

  it('falls back to a generic heading when the session has no title', async () => {
    useActiveSessionStore.getState().start({
      tasks: [{ taskId: 't1', title: 'Free practice', durationMinutes: 5, completed: false }],
    });
    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('Practice session')).toBeTruthy();
    expect(screen.queryByText(/Following ·/)).toBeNull();
  });

  it('starts the clock at zero and counts up once a second', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));
    expect(screen.getByText('0:00')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(65_000);
    });

    expect(screen.getByText('1:05')).toBeTruthy();
  });

  it('shows the planned total, and omits it when the routine has no targets', async () => {
    startSession([
      { taskId: 't1', title: 'A' },
      { taskId: 't2', title: 'B' },
    ]);
    const planned = await render(withGluestack(<ActiveSessionScreen />));
    expect(screen.getByText('of 20 min planned')).toBeTruthy();
    await planned.unmount();

    useActiveSessionStore.getState().start({
      title: 'Freeform',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 0, completed: false }],
    });
    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.queryByText(/min planned/)).toBeNull();
  });

  it('ticks a task off through the store', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByRole('checkbox'));

    expect(useActiveSessionStore.getState().tasks[0].completed).toBe(true);
  });

  it('records per-task minutes through the stepper', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Increase minutes'));

    expect(useActiveSessionStore.getState().tasks[0].durationMinutes).toBe(11);
  });

  it('writes the session once on finish, then clears local state and confirms', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(mutation.mutateAsync).toHaveBeenCalledWith({
      routineId: 'r1',
      title: 'Morning warm-up',
      tasks: [{ taskId: 't1', durationMinutes: 10, completed: false }],
    });
    // Sessions are write-once, so finishing has to leave nothing behind locally.
    expect(useActiveSessionStore.getState().tasks).toEqual([]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toast).toMatchObject({
      message: 'Session saved',
      variant: 'success',
    });
  });

  it('sends the edited minutes and completion, not the routine targets', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Increase minutes'));
    await fireEvent.press(screen.getByRole('checkbox'));
    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(mutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [{ taskId: 't1', durationMinutes: 11, completed: true }],
      }),
    );
  });

  /**
   * `CreatePracticeSessionTaskDto.durationMinutes` is optional but `@Min(1)`, while 0 is the
   * local "nothing logged" value — every task of a routine with no target durations starts
   * there. Sending the zero made Finish fail with
   * "tasks.0.durationMinutes must not be less than 1".
   */
  it('omits minutes for a task that logged none, rather than sending a zero', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    useActiveSessionStore.getState().start({
      routineId: 'r1',
      title: 'Morning warm-up',
      tasks: [
        { taskId: 't1', title: 'Untimed', durationMinutes: 0, completed: false },
        { taskId: 't2', title: 'Timed', durationMinutes: 15, completed: true },
      ],
    });
    await render(withGluestack(<ActiveSessionScreen />));

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(mutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [
          { taskId: 't1', durationMinutes: undefined, completed: false },
          { taskId: 't2', durationMinutes: 15, completed: true },
        ],
      }),
    );
  });

  it('keeps the session and says so when the write fails', async () => {
    const mutation = {
      ...mutationStub(),
      mutateAsync: jest.fn(async () => {
        throw new ApiError('Bad Request', 400);
      }),
    };
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(useToastStore.getState().toast).toMatchObject({ variant: 'error' });
    // A session is written once. Clearing it here would lose the practice outright.
    expect(useActiveSessionStore.getState().tasks).toHaveLength(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('says it is saving and blocks a second finish while the write is in flight', async () => {
    const mutation = { ...mutationStub(), isPending: true };
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('Saving session…')).toBeTruthy();

    await fireEvent.press(screen.getByText('Saving session…'));

    expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('warns that exiting discards the session, and keeps it when cancelled', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Exit practice'));
    expect(
      screen.getByText('Nothing is saved until you finish. Exiting now discards this session.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Keep practicing'));

    expect(screen.queryByText('Exit practice?')).toBeNull();
    expect(useActiveSessionStore.getState().tasks).toHaveLength(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('discards the session on a confirmed exit, writing nothing', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Exit practice'));
    await fireEvent.press(screen.getByText('Exit'));

    expect(useActiveSessionStore.getState().tasks).toEqual([]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    // The whole point of the warning: an exit must not create a practice session.
    expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('makes clear nothing is stored until finish', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('Saved when you finish.')).toBeTruthy();
    expect(screen.getByText('Elapsed · on this device')).toBeTruthy();
  });
});
