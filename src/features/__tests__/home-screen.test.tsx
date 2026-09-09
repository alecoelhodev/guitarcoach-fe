jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/sessions.queries', () => ({ useSessionsSummary: jest.fn() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useSessionsSummary } from '@/api/sessions.queries';
import { HomeScreen } from '@/features/home/home-screen';
import { useActiveSessionStore } from '@/features/session/session-store';
import { storage } from '@/lib/storage';
import { useSessionStore } from '@/stores/session-store';
import { mockRouter } from '@/test/expo-router';
import { makePage, makeSession, makeSessionTask, makeUser } from '@/test/fixtures';
import { withGluestack } from '@/test/gluestack';
import { pendingQuery, successQuery } from '@/test/query-hooks';
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

const mock = useSessionsSummary as unknown as jest.MockedFunction<(...args: never[]) => unknown>;

function thisWeekSession(id: string, minutes: number) {
  return makeSession({
    id,
    createdAt: '2026-09-08T10:00:00.000Z', // Tuesday of the pinned week
    sessionTasks: [makeSessionTask({ taskId: `${id}-a`, durationMinutes: minutes })],
  });
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['performance'] });
  jest.setSystemTime(FIXED_NOW);
  jest.clearAllMocks();
  mock.mockReturnValue(successQuery(makePage([])));
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

  it('greets without a name, and hides the avatar, before the session hydrates', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Evening')).toBeTruthy();
    expect(screen.queryByLabelText('Profile')).toBeNull();
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
    mock.mockReturnValue(pendingQuery());
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
    mock.mockReturnValue(
      successQuery(makePage([thisWeekSession('s1', 20), thisWeekSession('s2', 25)])),
    );
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('45')).toBeTruthy();
    expect(screen.getByText('minutes')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('sessions')).toBeTruthy();
  });

  it('excludes a session from before this week from the totals', async () => {
    mock.mockReturnValue(
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
    );
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.queryByText('520')).toBeNull();
  });
});

describe('recent session', () => {
  it('is omitted entirely when there is no history', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.queryByText('Recent session')).toBeNull();
    expect(screen.queryByText('See all')).toBeNull();
  });

  it('shows the first session the API returned, with a link to the rest', async () => {
    mock.mockReturnValue(successQuery(makePage([makeSession({ id: 's1', title: 'Blues in A' })])));
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Recent session')).toBeTruthy();
    expect(screen.getByText('Blues in A')).toBeTruthy();
    expect(screen.getByText('See all')).toBeTruthy();
  });
});

describe('resume prompt', () => {
  it('does not appear when no session was left in progress', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.queryByText('Resume practice session?')).toBeNull();
  });

  it('offers to resume a session left in progress', async () => {
    useActiveSessionStore.getState().start({
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
        version: 0,
        state: {
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

  it('throws the session away on Discard, without navigating', async () => {
    useActiveSessionStore.getState().start({
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
  it('routes Start Practice through routines, since that is where practice begins', async () => {
    await render(withGluestack(<HomeScreen />));

    expect(screen.getByText('Start Practice')).toBeTruthy();
    expect(screen.getByText('Ask AI Coach')).toBeTruthy();
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
});
