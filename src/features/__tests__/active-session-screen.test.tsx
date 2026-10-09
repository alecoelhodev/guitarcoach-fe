jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/sessions.queries', () => ({ useCreateSession: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/api/recordings.queries', () => ({ useUploadSessionClips: jest.fn() }));
jest.mock('@/features/recordings/pending-clip-files', () => ({
  keepClipFile: jest.fn(async (id: string) => `file:///doc/${id}.m4a`),
  clipBlob: jest.fn(() => undefined),
  discardClipFile: jest.fn(),
}));
// A render counter on a task row. The real component still renders — this only records that
// it was asked to, which is the only way to prove the clock's tick stays out of the list.
jest.mock('@/components/ui/checklist-row', () => {
  const actual = jest.requireActual('@/components/ui/checklist-row');
  return {
    ChecklistRow: jest.fn((props) => actual.ChecklistRow(props)),
  };
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { useUploadSessionClips } from '@/api/recordings.queries';
import { useCreateSession } from '@/api/sessions.queries';
import { ChecklistRow } from '@/components/ui/checklist-row';
import { ActiveSessionScreen } from '@/features/session/active-session-screen';
import { type ActiveSessionTask, useActiveSessionStore } from '@/features/session/session-store';
import { storage } from '@/lib/storage';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { makeUser } from '@/test/fixtures';
import { withGluestack } from '@/test/gluestack';
import { countHostProp } from '@/test/host-props';
import { mutationStub } from '@/test/query-hooks';

/**
 * Wrapped in `withGluestack` throughout, because the exit confirmation is a Gluestack overlay
 * and renders nothing without a provider to portal into.
 *
 * Fake timers throughout too: `useStopwatch` ticks a `setInterval` every second, so on real
 * timers the clock advances mid-test and keeps running after teardown.
 */

/** What `createSession` resolves to; Finish uploads pending clips to its `id`. */
const SAVED = { id: 'session-new' };

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
  useCreateSessionMock.mockReturnValue(mutationStub(SAVED));
  jest.mocked(useUploadSessionClips).mockReturnValue(mutationStub(0) as never);
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
   * The tick used to live in the screen body, so every second re-rendered the whole session:
   * each task card, its checkbox, its minutes stepper, and the notes field the user was
   * typing into. `TextInput` is the one that shows — a controlled input re-rendered under a
   * composing keyboard drops characters on Android.
   *
   * Asserted through a render counter on a sibling rather than a snapshot, because the
   * clock's own text must still change.
   */
  it('advances the clock without re-rendering the rest of the session', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    const rowRenders = (ChecklistRow as unknown as jest.Mock).mock.calls.length;
    expect(rowRenders).toBeGreaterThan(0);

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByText('0:03')).toBeTruthy();
    // Three ticks, and the task row was not asked to render for any of them.
    expect((ChecklistRow as unknown as jest.Mock).mock.calls).toHaveLength(rowRenders);
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
    const mutation = mutationStub(SAVED);
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
    const mutation = mutationStub(SAVED);
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
    const mutation = mutationStub(SAVED);
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
    const mutation = mutationStub(SAVED);
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
    const mutation = mutationStub(SAVED);
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
    const mutation = mutationStub(SAVED);
    mutation.mutateAsync = jest
      .fn<Promise<unknown>, []>()
      .mockRejectedValueOnce(new ApiError('boom', OFFLINE_STATUS))
      .mockResolvedValueOnce(SAVED);
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
    const mutation = { ...mutationStub(SAVED), isPending: true };
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
    const mutation = mutationStub(SAVED);
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
    const mutation = mutationStub(SAVED);
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
    const mutation = mutationStub(SAVED);
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
    const mutation = mutationStub(SAVED);
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
    const mutation = mutationStub(SAVED);
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

  describe('note and title drafts', () => {
    /** `persist` writes the whole session on every `set()`; these count those writes. */
    function sessionWrites(spy: jest.SpyInstance) {
      return spy.mock.calls.filter(([key]) => key === 'active-session');
    }

    it('commits a burst of typing once, after the pause, not per keystroke', async () => {
      startSession();
      await render(withGluestack(<ActiveSessionScreen />));
      const setItem = jest.spyOn(storage, 'setItem');

      const text = 'Metronome!';
      for (let i = 1; i <= text.length; i += 1) {
        await fireEvent.changeText(screen.getByTestId('session-notes'), text.slice(0, i));
        await act(async () => {
          jest.advanceTimersByTime(100);
        });
      }
      expect(sessionWrites(setItem)).toHaveLength(0);

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(sessionWrites(setItem).length).toBeGreaterThanOrEqual(1);
      expect(sessionWrites(setItem).length).toBeLessThanOrEqual(2);
      expect(useActiveSessionStore.getState().notes).toBe('Metronome!');
    });

    it('commits immediately on blur', async () => {
      startSession();
      await render(withGluestack(<ActiveSessionScreen />));

      await fireEvent.changeText(screen.getByTestId('session-notes'), 'Slow first');
      expect(useActiveSessionStore.getState().notes).toBeUndefined();
      await fireEvent(screen.getByTestId('session-notes'), 'blur');
      expect(useActiveSessionStore.getState().notes).toBe('Slow first');

      await fireEvent.press(screen.getByLabelText('Rename session'));
      await fireEvent.changeText(screen.getByTestId('session-title'), 'Evening');
      await fireEvent(screen.getByTestId('session-title'), 'blur');
      expect(useActiveSessionStore.getState().title).toBe('Evening');
    });

    // The debounce must never cost the last words typed before Finish.
    it('finishes with the latest text even inside the debounce window', async () => {
      const mutation = mutationStub(SAVED);
      useCreateSessionMock.mockReturnValue(mutation);
      startSession();
      await render(withGluestack(<ActiveSessionScreen />));

      await fireEvent.press(screen.getByLabelText('Rename session'));
      await fireEvent.changeText(screen.getByTestId('session-title'), 'Evening practice');
      await fireEvent.changeText(screen.getByTestId('session-notes'), 'Last words');
      await act(async () => {
        await fireEvent.press(screen.getByText('Finish Session'));
      });

      expect(mutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Evening practice', notes: 'Last words' }),
      );
    });

    it('keeps the latest text in the session when the save fails', async () => {
      const mutation = mutationStub(SAVED);
      mutation.mutateAsync = jest.fn(async () => {
        throw new ApiError('boom', OFFLINE_STATUS);
      });
      useCreateSessionMock.mockReturnValue(mutation);
      startSession();
      await render(withGluestack(<ActiveSessionScreen />));

      await fireEvent.changeText(screen.getByTestId('session-notes'), 'Unsaved');
      await act(async () => {
        await fireEvent.press(screen.getByText('Finish Session'));
      });

      expect(useActiveSessionStore.getState().notes).toBe('Unsaved');
    });

    it('flushes a pending draft on unmount', async () => {
      startSession();
      const view = await render(withGluestack(<ActiveSessionScreen />));

      await fireEvent.changeText(screen.getByTestId('session-notes'), 'Backgrounded');
      await view.unmount();

      expect(useActiveSessionStore.getState().notes).toBe('Backgrounded');
    });

    // A draft landing after a discard would write notes back into the emptied store.
    it('drops a pending draft when the session is discarded', async () => {
      startSession();
      await render(withGluestack(<ActiveSessionScreen />));

      await fireEvent.changeText(screen.getByTestId('session-notes'), 'Throwaway');
      await fireEvent.press(screen.getByLabelText('Exit practice'));
      await fireEvent.press(screen.getByText('Discard session'));
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(useActiveSessionStore.getState().notes).toBeUndefined();
    });

    it('starts from the notes restored with the session', async () => {
      startSession();
      useActiveSessionStore.getState().setNotes('From before');

      await render(withGluestack(<ActiveSessionScreen />));

      expect(screen.getByTestId('session-notes').props.value).toBe('From before');
    });
  });

  it('makes clear nothing is stored until finish', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    expect(screen.getByText('Saved when you finish.')).toBeTruthy();
    expect(screen.getByText('Elapsed · on this device')).toBeTruthy();
  });
});

// The screen puts its primary action directly under a text field, so the scroll view has to
// keep taps rather than spend the first one dismissing the keyboard.
it('keeps controls tappable while the keyboard is up', async () => {
  startSession();
  await render(withGluestack(<ActiveSessionScreen />));

  expect(countHostProp(screen.root, 'keyboardShouldPersistTaps', 'handled')).toBeGreaterThan(0);
});

describe('recordings', () => {
  const asset = {
    uri: 'file:///cache/take.m4a',
    name: 'take.m4a',
    mimeType: 'audio/mp4',
    size: 4096,
    lastModified: 0,
  };

  beforeEach(() => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [asset],
    });
  });

  async function attachFile() {
    await act(async () => {
      await fireEvent.press(screen.getByText('Choose file'));
    });
  }

  it('holds a chosen file on the device until finish, and can remove it', async () => {
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await attachFile();

    // The jest.setup player reports a 10 s file.
    expect(screen.getByText('take.m4a · 0:10')).toBeTruthy();
    expect(useActiveSessionStore.getState().clips).toEqual([
      expect.objectContaining({ name: 'take.m4a', mimeType: 'audio/mp4', seconds: 10 }),
    ]);

    await fireEvent.press(screen.getByLabelText('Remove take.m4a'));

    expect(screen.queryByText('take.m4a · 0:10')).toBeNull();
    expect(useActiveSessionStore.getState().clips).toEqual([]);
  });

  it('uploads the held clips to the session Finish just created', async () => {
    const uploads = mutationStub(0);
    jest.mocked(useUploadSessionClips).mockReturnValue(uploads as never);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));
    await attachFile();

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(uploads.mutateAsync).toHaveBeenCalledWith({
      sessionId: SAVED.id,
      files: [expect.objectContaining({ name: 'take.m4a', mimeType: 'audio/mp4' })],
    });
    expect(useActiveSessionStore.getState().clips).toEqual([]);
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Session saved' });
  });

  // The session already exists by then, so a retried Finish would write it twice.
  it('still finishes when a clip fails to upload, and says where to add it', async () => {
    const create = mutationStub(SAVED);
    useCreateSessionMock.mockReturnValue(create);
    jest.mocked(useUploadSessionClips).mockReturnValue(mutationStub(1) as never);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));
    await attachFile();

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(create.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(useActiveSessionStore.getState().tasks).toEqual([]);
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Session saved — 1 recording didn't upload. Add it from History.",
      variant: 'error',
    });
  });

  it('skips the upload step when nothing was recorded', async () => {
    const uploads = mutationStub(0);
    jest.mocked(useUploadSessionClips).mockReturnValue(uploads as never);
    startSession();
    await render(withGluestack(<ActiveSessionScreen />));

    await act(async () => {
      await fireEvent.press(screen.getByText('Finish Session'));
    });

    expect(uploads.mutateAsync).not.toHaveBeenCalled();
  });
});
