jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/sessions.queries', () => ({ useCreateSession: jest.fn() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { useCreateSession } from '@/api/sessions.queries';
import { ActiveSessionScreen } from '@/features/session/active-session-screen';
import { type ActiveSessionTask, useActiveSessionStore } from '@/features/session/session-store';
import { storage } from '@/lib/storage';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { makeUser } from '@/test/fixtures';
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

/** The session screen only shows a session its own owner started, so every test needs one. */
const SIGNED_IN = makeUser({ id: 'user-1' });

function startSession(
  tasks: (Partial<ActiveSessionTask> & { taskId: string; title: string })[] = [
    { taskId: 't1', title: 'Alternate picking' },
  ],
) {
  useActiveSessionStore.getState().start({
    userId: SIGNED_IN.id,
    routineId: 'r1',
    routineTitle: 'Morning warm-up',
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
  useSessionStore.setState({ status: 'authenticated', user: SIGNED_IN });
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

  // QA-05: the empty state used to be latched at mount, so once the store was emptied by a
  // successful Finish the screen carried on drawing a live session — a 0:00 clock, no tasks
  // and an enabled Finish Session that would have posted an empty one. Derived now.
  it('falls back to the empty state when the session is cleared underneath it', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));
    expect(screen.getByText('Finish Session')).toBeTruthy();

    await act(async () => useActiveSessionStore.getState().reset());

    expect(screen.getByText('No active session')).toBeTruthy();
    expect(screen.queryByText('Finish Session')).toBeNull();
  });

  // QA-01. The store persists under one device-wide key, so a session can outlive the account
  // that wrote it. Even reaching this route directly must not show another user's notes.
  it('refuses a session another account left behind', async () => {
    startSession();
    useSessionStore.setState({ status: 'authenticated', user: makeUser({ id: 'user-2' }) });

    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('No active session')).toBeTruthy();
    expect(screen.queryByText('Morning warm-up')).toBeNull();
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
        version: 1,
        state: {
          userId: 'user-1',
          routineId: 'r1',
          routineTitle: 'Morning warm-up',
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
      userId: SIGNED_IN.id,
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

  /**
   * The bug spec 08 exists for. The clock used to be `useState(0)` plus a tick, so a
   * backgrounded app — which suspends the interval — came back showing 00:00 beside the tasks
   * it had faithfully persisted. Deriving from `startedAt` is what makes the two agree.
   */
  it('shows the time already elapsed when a session is resumed, not zero', async () => {
    startSession();
    useActiveSessionStore.setState({ startedAt: Date.now() - 12 * 60_000 - 30_000 });

    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('12:30')).toBeTruthy();
  });

  it('reads zero rather than NaN for a session persisted before startedAt existed', async () => {
    startSession();
    useActiveSessionStore.setState({ startedAt: undefined });

    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('0:00')).toBeTruthy();
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

  // QA-05: this route is always pushed, so `back()` is normally right — but a web reload or a
  // deep link onto it leaves nothing to pop, and `back()` then did nothing at all. The user
  // was left on the session they had just saved, now empty, with Finish still enabled.
  it('replaces rather than popping when there is no history to go back to', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(main)/(tabs)');
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
   * there. That bound does not survive into the generated `api.d.ts`, so nothing but this test
   * stops it making every Finish a 400 with
   * "tasks.0.durationMinutes must not be less than 1". Both tasks in one payload: the untimed
   * one must lose the key, the timed one must keep it.
   */
  it('omits minutes for a task that logged none, rather than sending a zero', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession([
      { taskId: 't1', title: 'Untimed', targetDurationMinutes: undefined, durationMinutes: 0 },
      { taskId: 't2', title: 'Timed', durationMinutes: 15, completed: true },
    ]);
    await render(withGluestack(<ActiveSessionScreen />));

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(mutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [
          { taskId: 't1', completed: false },
          { taskId: 't2', durationMinutes: 15, completed: true },
        ],
      }),
    );
  });

  /**
   * The minutes exist only in local state until this write lands, so a failed save that still
   * reset the store would destroy the user's whole session. It also must not be an unhandled
   * rejection — that surfaces as a red screen rather than a message.
   */
  it('keeps the session and shows why when the write fails', async () => {
    const mutation = mutationStub();
    mutation.mutateAsync = jest.fn(async () => {
      throw new ApiError('boom', OFFLINE_STATUS);
    });
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(screen.getByText('No connection')).toBeTruthy();
    expect(useActiveSessionStore.getState().tasks).toHaveLength(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('clears the failure when a retry succeeds', async () => {
    const mutation = mutationStub();
    mutation.mutateAsync = jest
      .fn<Promise<unknown>, []>()
      .mockRejectedValueOnce(new ApiError('boom', OFFLINE_STATUS))
      .mockResolvedValueOnce(undefined);
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });
    expect(screen.getByText('No connection')).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(screen.queryByText('No connection')).toBeNull();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
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

  /**
   * Canvas 07b counts what is at stake rather than warning in the abstract, because a finished
   * session cannot be edited afterwards — this dialog is the last chance to correct the numbers.
   */
  it('counts the unsaved minutes and completed tasks in the exit prompt', async () => {
    startSession([
      { taskId: 't1', title: 'Alternate picking', completed: true },
      { taskId: 't2', title: 'Barre chords' },
    ]);
    await render(withGluestack(<ActiveSessionScreen />));

    await act(async () => {
      jest.advanceTimersByTime(18 * 60_000);
    });
    await fireEvent.press(screen.getByLabelText('Exit practice'));

    expect(
      screen.getByText("18 minutes and 1 completed task haven't been saved yet."),
    ).toBeTruthy();
  });

  it('keeps the session when the prompt is dismissed', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Exit practice'));
    await fireEvent.press(screen.getByText('Keep practicing'));

    expect(screen.queryByText('Leave this session?')).toBeNull();
    expect(useActiveSessionStore.getState().tasks).toHaveLength(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('discards the session without writing anything', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Exit practice'));
    await fireEvent.press(screen.getByText('Discard session'));

    expect(useActiveSessionStore.getState().tasks).toEqual([]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    // Nothing partial exists on the server, so discarding needs no request — and must not
    // accidentally make one.
    expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('saves from the exit prompt, which is the same write as Finish', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Exit practice'));
    await act(async () => {
      await fireEvent.press(screen.getByText('Finish and save'));
    });

    expect(mutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(useActiveSessionStore.getState().tasks).toEqual([]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('sends the notes typed during the session', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.changeText(screen.getByTestId('session-notes'), '  Metronome at 80.  ');
    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(mutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Metronome at 80.' }),
    );
  });

  /**
   * `notes` and `title` are both optional and both reject '' — `title` via `@Length(1, 200)`,
   * and `forbidNonWhitelisted` turns a stray blank into a 400 rather than an ignored field. The
   * same trap class as `durationMinutes` being `@Min(1)`.
   */
  it('omits an untouched note and an emptied title rather than sending blanks', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Rename session'));
    await fireEvent.changeText(screen.getByTestId('session-title'), '   ');
    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    const payload = mutation.mutateAsync.mock.calls[0][0];
    expect(payload).not.toHaveProperty('title');
    expect(payload).not.toHaveProperty('notes');
  });

  it('renames the session, keeping the routine it follows', async () => {
    const mutation = mutationStub();
    useCreateSessionMock.mockReturnValue(mutation);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Rename session'));
    await fireEvent.changeText(screen.getByTestId('session-title'), 'Evening practice');
    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(mutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Evening practice' }),
    );
  });

  it('falls back to a generic heading once the title is cleared', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await fireEvent.press(screen.getByLabelText('Rename session'));
    await fireEvent.changeText(screen.getByTestId('session-title'), '');
    await fireEvent(screen.getByTestId('session-title'), 'blur');

    expect(screen.getByText('Practice session')).toBeTruthy();
    // The routine line is separate state, so renaming never rewrites what is being followed.
    expect(screen.getByText('Following · Morning warm-up')).toBeTruthy();
  });

  it('makes clear nothing is stored until finish', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('Saved when you finish.')).toBeTruthy();
    expect(screen.getByText('Elapsed · on this device')).toBeTruthy();
  });
});
