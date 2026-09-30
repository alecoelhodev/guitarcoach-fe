jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/sessions.queries', () => ({ useSessionsSummary: jest.fn() }));
jest.mock('@/api/routines.queries', () => ({
  useRoutines: jest.fn(),
  useRoutine: jest.fn(),
  useRoutineTasks: jest.fn(),
}));
jest.mock('@/hooks/use-is-wide', () => ({ useIsWide: jest.fn() }));
// Mocked for the same reason the query hooks are: `useStartPractice` needs a real
// QueryClient, and its own suite covers the seed-and-navigate behaviour. Here the screen
// only has to hand it the right routine and tasks.
jest.mock('@/features/session/use-start-practice', () => ({ useStartPractice: jest.fn() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { useRoutine, useRoutines, useRoutineTasks } from '@/api/routines.queries';
import { useSessionsSummary } from '@/api/sessions.queries';
import { HomeScreen } from '@/features/home/home-screen';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useStartPractice } from '@/features/session/use-start-practice';
import { useIsWide } from '@/hooks/use-is-wide';
import { storage } from '@/lib/storage';
import { useSessionStore } from '@/stores/session-store';
import { mockRouter, setMockPathname } from '@/test/expo-router';
import {
  makePage,
  makeRoutine,
  makeRoutineTaskWithTask,
  makeSession,
  makeSessionTask,
  makeTask,
  makeUser,
} from '@/test/fixtures';
import { withGluestack } from '@/test/gluestack';
import { pressLinkTarget } from '@/test/press';
import {
  emptyQuery,
  errorInfinite,
  errorQuery,
  infinitePages,
  mutationStub,
  pendingQuery,
  successQuery,
} from '@/test/query-hooks';
import { MaxContentWidth } from '@/theme/tokens';

/**
 * Two reasons this suite pins the clock rather than just the timezone.
 *
 * `partOfDay()` is called with no argument, so it reads `new Date().getHours()` and the
 * greeting changes with the wall clock — a test asserting "Evening" passes only in the
 * evening. And `filterThisWeek` compares against "now", so which sessions count as this week
 * depends on the day the suite runs. `jest.config.js` pins TZ to UTC; the date is pinned here.
 */

const FIXED_NOW = new Date('2026-09-09T20:00:00.000Z'); // a Wednesday, 20:00 UTC → "Evening"

const mockSessions = useSessionsSummary as jest.MockedFunction<typeof useSessionsSummary>;
const mockRoutines = useRoutines as jest.MockedFunction<typeof useRoutines>;
const mockRoutine = useRoutine as jest.MockedFunction<typeof useRoutine>;
const mockRoutineTasks = useRoutineTasks as jest.MockedFunction<typeof useRoutineTasks>;
const mockIsWide = useIsWide as jest.MockedFunction<typeof useIsWide>;
const mockStartPractice = useStartPractice as jest.MockedFunction<typeof useStartPractice>;

/** Reassigned per test so assertions can read the `mutate` the screen actually called. */
let startPractice: ReturnType<typeof mutationStub>;

// The hooks are mocked, so their real generics are irrelevant here — the screen only reads
// `data`/`isPending`, which is exactly what the query-hooks builders provide.
const asHookResult = <T,>(value: T) => value as never;

function thisWeekSession(id: string, minutes: number) {
  return makeSession({
    id,
    createdAt: '2026-09-08T10:00:00.000Z', // Tuesday of the pinned week
    sessionTasks: [makeSessionTask({ taskId: `${id}-a`, durationMinutes: minutes })],
  });
}

/** No history and no routines — Home's default in this suite is the populated screen. */
function givenNoRoutines() {
  mockRoutines.mockReturnValue(asHookResult(infinitePages([makePage([])])));
  mockRoutine.mockReturnValue(asHookResult(emptyQuery()));
  mockRoutineTasks.mockReturnValue(asHookResult(emptyQuery()));
}

function givenRoutines(...routines: ReturnType<typeof makeRoutine>[]) {
  mockRoutines.mockReturnValue(asHookResult(infinitePages([makePage(routines)])));
  mockRoutine.mockReturnValue(asHookResult(successQuery(routines[0])));
  mockRoutineTasks.mockReturnValue(asHookResult(successQuery([])));
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['performance'] });
  jest.setSystemTime(FIXED_NOW);
  jest.clearAllMocks();
  mockIsWide.mockReturnValue(false);
  startPractice = mutationStub();
  mockStartPractice.mockReturnValue(asHookResult(startPractice));
  mockSessions.mockReturnValue(asHookResult(successQuery(makePage([]))));
  // A user with routines but no history: keeps the new-user state out of the way
  // of every test that is not about it.
  givenRoutines(makeRoutine());
});

afterEach(() => jest.useRealTimers());

describe('greeting', () => {
  it('greets by time of day and name when a user is cached', async () => {
    useSessionStore.setState({ status: 'authenticated', user: makeUser({ name: 'Jordan' }) });
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Evening, Jordan')).toBeTruthy();
    expect(screen.getByLabelText('Profile')).toBeTruthy();
    expect(screen.getByText('J')).toBeTruthy();
  });

  // QA-02: the avatar announced itself as a button and did nothing on the simulator, because
  // `<Link asChild>` forwards `onPress` and a plain `View` has nowhere to put it.
  it('opens the profile when the avatar is pressed', async () => {
    useSessionStore.setState({ status: 'authenticated', user: makeUser({ name: 'Jordan' }) });
    await render(withGluestack(<HomeScreen />));

    await pressLinkTarget(screen.getByLabelText('Profile'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/(main)/(tabs)/profile');
  });

  it('greets without a name, and hides the avatar, before the session hydrates', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Evening')).toBeTruthy();
    expect(screen.queryByLabelText('Profile')).toBeNull();
  });

  // Canvas 02 pairs the greeting with a prompt, not just the time of day.
  it('carries the canvas subline', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Ready for 30 minutes?')).toBeTruthy();
  });

  it.each([
    ['2026-09-09T06:00:00.000Z', 'Morning'],
    ['2026-09-09T11:59:00.000Z', 'Morning'],
    ['2026-09-09T12:00:00.000Z', 'Afternoon'],
    ['2026-09-09T17:59:00.000Z', 'Afternoon'],
    ['2026-09-09T18:00:00.000Z', 'Evening'],
  ])('says %s → %s', async (now, expected) => {
    jest.setSystemTime(new Date(now));
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe('this week', () => {
  it('shows a skeleton while the summary loads', async () => {
    mockSessions.mockReturnValue(asHookResult(pendingQuery()));
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.queryByText('minutes')).toBeNull();
  });

  it('explains how the numbers get there when nothing is logged', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(
      screen.getByText(
        'Nothing logged yet. Your minutes and sessions appear here after your first practice.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('minutes')).toBeNull();
  });

  it('sums minutes and counts sessions inside the current week', async () => {
    mockSessions.mockReturnValue(
      asHookResult(successQuery(makePage([thisWeekSession('s1', 20), thisWeekSession('s2', 25)]))),
    );
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('45')).toBeTruthy();
    expect(screen.getByText('minutes')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('sessions')).toBeTruthy();
  });

  it('excludes a session from before this week from the totals', async () => {
    mockSessions.mockReturnValue(
      asHookResult(
        successQuery(
          makePage([
            thisWeekSession('s1', 20),
            makeSession({
              id: 'old',
              createdAt: '2026-08-20T10:00:00.000Z',
              sessionTasks: [makeSessionTask({ durationMinutes: 500 })],
            }),
          ]),
        ),
      ),
    );
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.queryByText('520')).toBeNull();
  });
});

/**
 * The backend has no scheduled-routine concept, so which routine appears here is
 * derived — see `use-todays-practice.ts`. These pin that derivation.
 */
describe("today's practice", () => {
  it('shows the routine behind the most recent session', async () => {
    const practised = makeRoutine({ id: 'r-practised', title: 'Blues in A' });
    mockSessions.mockReturnValue(
      asHookResult(successQuery(makePage([makeSession({ id: 's1', routineId: 'r-practised' })]))),
    );
    mockRoutines.mockReturnValue(
      asHookResult(infinitePages([makePage([makeRoutine({ id: 'r-other', title: 'Other' })])])),
    );
    mockRoutine.mockReturnValue(asHookResult(successQuery(practised)));
    mockRoutineTasks.mockReturnValue(asHookResult(successQuery([])));

    await render(withGluestack(<HomeScreen />));

    expect(useRoutine).toHaveBeenCalledWith('r-practised');
    expect(screen.getByText("Today's practice")).toBeTruthy();
    expect(screen.getByText('Blues in A')).toBeTruthy();
  });

  it('falls back to the newest active routine for someone who has never practised', async () => {
    givenRoutines(makeRoutine({ id: 'r-newest', title: 'Warm-up routine' }));

    await render(withGluestack(<HomeScreen />));

    expect(useRoutine).toHaveBeenCalledWith('r-newest');
    // Twice: the sole active routine is both the day's pick and the only strip card.
    expect(screen.getAllByText('Warm-up routine')).toHaveLength(2);
  });

  // Sessions can be blank — a blank session has no routineId — so the pick has to
  // skip past them rather than give up at the newest row.
  it('skips sessions that were not run from a routine', async () => {
    mockSessions.mockReturnValue(
      asHookResult(
        successQuery(
          makePage([
            makeSession({ id: 'blank', routineId: null }),
            makeSession({ id: 's2', routineId: 'r-practised' }),
          ]),
        ),
      ),
    );

    await render(withGluestack(<HomeScreen />));

    expect(useRoutine).toHaveBeenCalledWith('r-practised');
  });

  it('lists the task titles and the routine meta from the backend totals', async () => {
    givenRoutines(
      makeRoutine({ id: 'r1', title: 'Warm-up', taskCount: 2, totalTargetDurationMinutes: 45 }),
    );
    mockRoutineTasks.mockReturnValue(
      asHookResult(
        successQuery([
          makeRoutineTaskWithTask({ taskId: 't1', task: makeTask({ title: 'Major scale' }) }),
          makeRoutineTaskWithTask({ taskId: 't2', task: makeTask({ title: 'Barre chords' }) }),
        ]),
      ),
    );

    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Major scale · Barre chords')).toBeTruthy();
    // The card's badge and the strip card's meta line, both off the same
    // backend totals rather than a recount of the task list.
    expect(screen.getAllByText('2 tasks · 45 min')).toHaveLength(2);
  });

  it('adds the View routine action only on the wide layout', async () => {
    await render(withGluestack(<HomeScreen />));
    expect(screen.queryByText('View routine')).toBeNull();

    mockIsWide.mockReturnValue(true);
    await render(withGluestack(<HomeScreen />));
    expect(screen.getByText('View routine')).toBeTruthy();
  });
});

describe("today's practice — a routine with no tasks", () => {
  /**
   * QA-06, third entry point. The pick is derived — the newest active routine — and that
   * routine can legitimately have no tasks: Instant Create produces them, and so does
   * creating one by hand. The card badged "0 tasks" and still offered Start Practice, which
   * opened "No active session". Found by re-testing the fix in a browser, not by the report.
   */
  it('will not start it, and says what is missing instead', async () => {
    givenRoutines(makeRoutine({ id: 'r1', title: 'QA Empty Routine', taskCount: 0 }));
    mockRoutineTasks.mockReturnValue(asHookResult(successQuery([])));
    await render(withGluestack(<HomeScreen />));

    await fireEvent.press(screen.getByText('Start Practice'));

    expect(startPractice.mutate).not.toHaveBeenCalled();
    expect(screen.getByText('Add a task to this routine before practising it.')).toBeTruthy();
  });

  it('still starts a routine that has tasks', async () => {
    const routine = makeRoutine({ id: 'r1', title: 'Morning warm-up', taskCount: 1 });
    givenRoutines(routine);
    const tasks = [makeRoutineTaskWithTask({ task: makeTask({ title: 'Scales' }) })];
    mockRoutineTasks.mockReturnValue(asHookResult(successQuery(tasks)));
    await render(withGluestack(<HomeScreen />));

    await fireEvent.press(screen.getByText('Start Practice'));

    expect(startPractice.mutate).toHaveBeenCalledWith({ routine, tasks });
  });
});

describe('active routines', () => {
  it('lists each active routine with its task count and duration', async () => {
    givenRoutines(
      makeRoutine({ id: 'r1', title: 'Warm-up', taskCount: 4, totalTargetDurationMinutes: 45 }),
      makeRoutine({
        id: 'r2',
        title: 'Fingerstyle focus',
        taskCount: 2,
        totalTargetDurationMinutes: 35,
      }),
    );

    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Active routines')).toBeTruthy();
    expect(screen.getByText('Fingerstyle focus')).toBeTruthy();
    expect(screen.getByText('2 tasks · 35 min')).toBeTruthy();
  });

  // Canvas 02 labels the link "All"; 2a has room for "All routines".
  it('shortens the link label on the narrow layout', async () => {
    await render(withGluestack(<HomeScreen />));
    expect(screen.getByText('All')).toBeTruthy();

    mockIsWide.mockReturnValue(true);
    await render(withGluestack(<HomeScreen />));
    expect(screen.getByText('All routines')).toBeTruthy();
  });

  // QA-02, same class as the Library and History cards: the mobile strip tile is the whole
  // affordance, so it has to be pressable rather than a Card wrapping a View.
  it('opens a routine when its strip tile is pressed', async () => {
    // Two routines: the first is also drawn by "Today's practice", so only the second
    // title is unique to the strip.
    givenRoutines(
      makeRoutine({ id: 'r1', title: 'Warm-up' }),
      makeRoutine({ id: 'r2', title: 'Fingerstyle focus' }),
    );
    await render(withGluestack(<HomeScreen />));

    await pressLinkTarget(screen.getByText('Fingerstyle focus'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/routines/[id]',
      params: { id: 'r2' },
    });
  });

  it('gives each card a Start action only on the wide grid', async () => {
    await render(withGluestack(<HomeScreen />));
    expect(screen.queryByText('Start')).toBeNull();

    mockIsWide.mockReturnValue(true);
    await render(withGluestack(<HomeScreen />));
    expect(screen.getByText('Start')).toBeTruthy();
  });
});

describe('recent sessions', () => {
  it('is omitted entirely when there is no history', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.queryByText('Recent session')).toBeNull();
    expect(screen.queryByText('See all')).toBeNull();
  });

  it('shows the first session the API returned, with a link to the rest', async () => {
    mockSessions.mockReturnValue(
      asHookResult(successQuery(makePage([makeSession({ id: 's1', title: 'Blues in A' })]))),
    );
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Recent session')).toBeTruthy();
    expect(screen.getByText('Blues in A')).toBeTruthy();
    expect(screen.getByText('See all')).toBeTruthy();
  });

  // QA-02 again: the wide table's rows were a bare View under `<Link asChild>`.
  it('opens a session when a wide table row is pressed', async () => {
    mockIsWide.mockReturnValue(true);
    mockSessions.mockReturnValue(
      asHookResult(successQuery(makePage([makeSession({ id: 's1', title: 'Blues in A' })]))),
    );
    await render(withGluestack(<HomeScreen />));

    await pressLinkTarget(screen.getByText('Blues in A'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/history/[id]',
      params: { id: 's1' },
    });
  });

  // Canvas 2a collapses the stacked cards into a table and pluralises the heading.
  it('becomes a multi-row table on the wide layout', async () => {
    mockIsWide.mockReturnValue(true);
    mockSessions.mockReturnValue(
      asHookResult(
        successQuery(
          makePage([
            makeSession({ id: 's1', title: 'Evening practice' }),
            makeSession({ id: 's2', title: 'Quick theory review' }),
          ]),
        ),
      ),
    );

    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Recent sessions')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByText('Evening practice')).toBeTruthy();
    expect(screen.getByText('Quick theory review')).toBeTruthy();
  });

  it('badges each wide row with its minutes and completion', async () => {
    mockIsWide.mockReturnValue(true);
    mockSessions.mockReturnValue(
      asHookResult(
        successQuery(
          makePage([
            makeSession({
              id: 's1',
              title: 'Evening practice',
              sessionTasks: [
                makeSessionTask({ taskId: 'a', durationMinutes: 20, completed: true }),
                makeSessionTask({ taskId: 'b', durationMinutes: 18, completed: false }),
              ],
            }),
          ]),
        ),
      ),
    );

    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('38 min')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
  });

  /**
   * Per-task minutes and the completed flag are both optional on the API, and a
   * session can carry no tasks at all — so an unbadged row is a real state.
   */
  it('drops both badges from a session with nothing to report', async () => {
    mockIsWide.mockReturnValue(true);
    mockSessions.mockReturnValue(
      asHookResult(
        successQuery(makePage([makeSession({ id: 's1', title: 'Untracked', sessionTasks: [] })])),
      ),
    );

    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Untracked')).toBeTruthy();
    expect(screen.queryByText(/min$/)).toBeNull();
    expect(screen.queryByText(/ of /)).toBeNull();
  });

  // Untitled sessions are allowed — `title` is optional on the API.
  it('falls back to a generic label for an untitled wide row', async () => {
    mockIsWide.mockReturnValue(true);
    mockSessions.mockReturnValue(
      asHookResult(successQuery(makePage([makeSession({ id: 's1', title: null })]))),
    );

    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Practice session')).toBeTruthy();
  });
});

/** Canvas 02c — no routines and no history. */
describe('new user', () => {
  beforeEach(givenNoRoutines);

  it('welcomes rather than greeting by time of day', async () => {
    useSessionStore.setState({ status: 'authenticated', user: makeUser({ name: 'Jordan' }) });
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Welcome, Jordan')).toBeTruthy();
    expect(screen.getByText("Let's set up your first routine.")).toBeTruthy();
    expect(screen.queryByText('Evening, Jordan')).toBeNull();
  });

  it('keeps all three entry points visible', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('No routines yet')).toBeTruthy();
    expect(screen.getByText('Browse Tasks')).toBeTruthy();
    expect(screen.getByText('Ask AI Coach')).toBeTruthy();
    expect(screen.getByText('Or just play')).toBeTruthy();
  });

  // The stat card stays in place so the layout does not jump once data arrives.
  it('keeps the This week card', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('This week')).toBeTruthy();
  });

  it("does not offer today's practice or the routines strip", async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.queryByText("Today's practice")).toBeNull();
    expect(screen.queryByText('Active routines')).toBeNull();
  });

  /**
   * Gated on the lists having resolved, not on `isPending` alone — otherwise the
   * new-user state flashes on every cold start before the routines arrive.
   */
  it('does not flash while the routine list is still loading', async () => {
    mockRoutines.mockReturnValue(asHookResult({ ...infinitePages([]), isPending: true }));
    await render(withGluestack(<HomeScreen />));

    expect(screen.queryByText('No routines yet')).toBeNull();
  });
});

describe('resume prompt', () => {
  /** The prompt is scoped to the session's owner, so these all sign the same person in. */
  const OWNER = makeUser({ id: 'user-1', name: 'Jordan' });

  beforeEach(() => {
    useSessionStore.setState({ status: 'authenticated', user: OWNER });
  });

  it('does not appear when no session was left in progress', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.queryByText('Resume practice session?')).toBeNull();
  });

  it('offers to resume a session left in progress', async () => {
    useActiveSessionStore.getState().start({
      userId: OWNER.id,
      title: 'Morning warm-up',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
    });
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Resume practice session?')).toBeTruthy();

    await fireEvent.press(screen.getByText('Resume'));

    expect(mockRouter.push).toHaveBeenCalledWith('/session/active');
    // Resuming must keep the in-progress tasks — they are the session.
    expect(useActiveSessionStore.getState().tasks).toHaveLength(1);
    expect(screen.queryByText('Resume practice session?')).toBeNull();
  });

  /**
   * `persist` reads AsyncStorage asynchronously, so the task list is still empty on the first
   * render. The prompt's visibility is derived rather than latched into `useState` for exactly
   * this reason — a lazy initialiser would capture "no session" and never offer the resume.
   */
  it('offers the resume once a session rehydrates after the first render', async () => {
    await storage.setItem(
      'active-session',
      JSON.stringify({
        version: 1,
        state: {
          userId: OWNER.id,
          title: 'Morning warm-up',
          tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
        },
      }),
    );
    const rehydrated = useActiveSessionStore.persist.rehydrate();

    await render(withGluestack(<HomeScreen />));
    await act(async () => {
      await rehydrated;
    });

    expect(screen.getByText('Resume practice session?')).toBeTruthy();
  });

  // QA-01: the store persists under one device-wide key, so a session survives a sign-out.
  // Offering it to the next account disclosed the previous user's routine, minutes and notes.
  it('never offers a session another account left behind', async () => {
    useActiveSessionStore.getState().start({
      userId: 'someone-else',
      title: 'Morning warm-up',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
    });

    await render(withGluestack(<HomeScreen />));

    expect(screen.queryByText('Resume practice session?')).toBeNull();
    // The prompt is the only door to that session's contents from here, so its absence is
    // the whole assertion: without it there is no Resume to press.
    expect(screen.queryByText('Resume')).toBeNull();
  });

  // QA-05: Home stays mounted under the session modal, so the moment practice started the
  // prompt appeared over the very session it was offering to resume — and a second mounted
  // Home stacked a second copy of the dialog on top.
  it('stays hidden while the session screen is the current route', async () => {
    useActiveSessionStore.getState().start({
      userId: OWNER.id,
      title: 'Morning warm-up',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
    });
    setMockPathname('/session/active');

    await render(withGluestack(<HomeScreen />));

    expect(screen.queryByText('Resume practice session?')).toBeNull();
  });

  it('throws the session away on Discard, without navigating', async () => {
    useActiveSessionStore.getState().start({
      userId: OWNER.id,
      title: 'Morning warm-up',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
    });
    await render(withGluestack(<HomeScreen />));

    await fireEvent.press(screen.getByText('Discard'));

    expect(useActiveSessionStore.getState().tasks).toEqual([]);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('primary actions', () => {
  // Canvas 02 puts Start Practice inside the Today's practice card rather than
  // standing alone, and keeps Ask AI Coach as the one full-width button.
  it('offers Start Practice and Ask AI Coach', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Start Practice')).toBeTruthy();
    expect(screen.getByText('Ask AI Coach')).toBeTruthy();
  });

  // Canvas 840: Start opens the session pre-loaded. It used to navigate to the routine
  // detail screen instead, which made the user press Start twice.
  it('starts the session from Home rather than routing to the routine', async () => {
    const routine = makeRoutine({ id: 'r1', title: 'Morning warm-up', taskCount: 1 });
    givenRoutines(routine);
    const tasks = [makeRoutineTaskWithTask({ task: makeTask({ title: 'Scales' }) })];
    mockRoutineTasks.mockReturnValue(asHookResult(successQuery(tasks)));

    await render(withGluestack(<HomeScreen />));
    await fireEvent.press(screen.getByText('Start Practice'));

    expect(startPractice.mutate).toHaveBeenCalledWith({ routine, tasks });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('starts from a wide routine-grid card, fetching its tasks on press', async () => {
    mockIsWide.mockReturnValue(true);
    const [first, second] = [
      makeRoutine({ id: 'r1' }),
      makeRoutine({ id: 'r2', title: 'Fingerstyle' }),
    ];
    givenRoutines(first, second);

    await render(withGluestack(<HomeScreen />));
    await fireEvent.press(screen.getAllByText('Start')[1]);

    // No `tasks` — the grid does not hold them, so the hook fetches them itself.
    expect(startPractice.mutate).toHaveBeenCalledWith({ routine: second });
  });

  it('labels only the routine being started, not every card', async () => {
    mockIsWide.mockReturnValue(true);
    const [first, second] = [
      makeRoutine({ id: 'r1' }),
      makeRoutine({ id: 'r2', title: 'Fingerstyle' }),
    ];
    givenRoutines(first, second);
    startPractice.isPending = true;
    startPractice.variables = { routine: second };

    await render(withGluestack(<HomeScreen />));

    expect(screen.getAllByText('Starting…')).toHaveLength(1);
  });
});

describe('load failures', () => {
  // A failed list leaves `sessions` and `activeRoutines` empty, which is indistinguishable
  // from a new account — Home used to greet an established user with the onboarding card.
  it('shows the error panel, not the new-user state, when the sessions query fails', async () => {
    mockSessions.mockReturnValue(asHookResult(errorQuery(new ApiError('', OFFLINE_STATUS))));
    givenNoRoutines();

    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('No connection')).toBeTruthy();
    expect(screen.queryByText('No routines yet')).toBeNull();
  });

  it('does the same when the routines query is the one that failed', async () => {
    mockRoutines.mockReturnValue(asHookResult(errorInfinite(new ApiError('', OFFLINE_STATUS))));
    mockRoutine.mockReturnValue(asHookResult(emptyQuery()));
    mockRoutineTasks.mockReturnValue(asHookResult(emptyQuery()));

    await render(withGluestack(<HomeScreen />));

    expect(screen.queryByText('No routines yet')).toBeNull();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('retries the query that failed', async () => {
    const failed = errorQuery(new ApiError('', OFFLINE_STATUS));
    mockSessions.mockReturnValue(asHookResult(failed));
    givenNoRoutines();

    await render(withGluestack(<HomeScreen />));
    await fireEvent.press(screen.getByText('Try again'));

    expect(failed.refetch).toHaveBeenCalled();
  });
});

describe("today's practice fallbacks", () => {
  // Canvas 839: archived routines are reviewable but never surfaced as a recommendation.
  it('skips an archived last-practised routine for the newest active one', async () => {
    const archived = makeRoutine({ id: 'r-old', title: 'Retired drills', status: 'archived' });
    const active = makeRoutine({ id: 'r-new', title: 'Current warm-up' });
    mockSessions.mockReturnValue(
      asHookResult(successQuery(makePage([makeSession({ id: 's1', routineId: 'r-old' })]))),
    );
    mockRoutines.mockReturnValue(asHookResult(infinitePages([makePage([active])])));
    // Keyed by id in production; the mock stands in for both lookups.
    mockRoutine.mockImplementation(((id: string | undefined) =>
      successQuery(id === 'r-old' ? archived : active)) as never);
    mockRoutineTasks.mockReturnValue(asHookResult(successQuery([])));

    await render(withGluestack(<HomeScreen />));

    // Twice over: the today's-practice card and the active-routines strip below it.
    expect(screen.getAllByText('Current warm-up')).toHaveLength(2);
    expect(screen.queryByText('Retired drills')).toBeNull();
  });

  // Loading has finished with nothing to recommend, but the account has history, so 02c
  // does not apply. The slot used to render nothing at all.
  it('keeps a quiet card when every routine is archived', async () => {
    mockSessions.mockReturnValue(asHookResult(successQuery(makePage([makeSession({ id: 's1' })]))));
    givenNoRoutines();

    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Go to routines')).toBeTruthy();
    expect(screen.queryByText('Start Practice')).toBeNull();
  });
});

describe('layout', () => {
  // The width cap has to sit on a node that is also capped at 100% of the screen. Home once
  // put it on the ScrollView's content container while the ScrollView itself was centred
  // rather than stretched, which left the ScrollView width-less and let it lay out at the
  // full 560pt cap on a 393pt phone.
  it('caps its width at the screen, not at MaxContentWidth alone', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByTestId('home-safe-area')).toHaveStyle({
      width: '100%',
      maxWidth: MaxContentWidth,
    });
  });

  // Canvas 2a's pane fills the width beside the rail, so the mobile cap is lifted.
  it('drops the content cap on the wide layout', async () => {
    mockIsWide.mockReturnValue(true);
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByTestId('home-safe-area')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('home-safe-area')).not.toHaveStyle({
      maxWidth: MaxContentWidth,
    });
  });
});
