import { countCompletedTasks, formatClock, formatMinutes, sumSessionMinutes } from '@/lib/duration';
import { makeSession, makeSessionTask } from '@/test/fixtures';
import type { PracticeSession } from '@/types/session';

/**
 * `sessionTasks` is non-optional in the generated DTO, but both reducers guard it with
 * `?? []`. Exercising that guard needs a cast — the point of these two cases is that the
 * guard works, not that the type allows it.
 */
const withoutTasks = {} as Pick<PracticeSession, 'sessionTasks'>;

describe('sumSessionMinutes', () => {
  it('sums the per-task minutes, which is the only total the API offers', () => {
    const session = makeSession({
      sessionTasks: [
        makeSessionTask({ taskId: 'a', durationMinutes: 15 }),
        makeSessionTask({ taskId: 'b', durationMinutes: 25 }),
      ],
    });

    expect(sumSessionMinutes(session)).toBe(40);
  });

  it('treats a task with no recorded minutes as zero rather than dropping the session', () => {
    const session = makeSession({
      sessionTasks: [
        makeSessionTask({ taskId: 'a', durationMinutes: 10 }),
        makeSessionTask({ taskId: 'b', durationMinutes: null }),
        makeSessionTask({ taskId: 'c' }),
      ],
    });

    expect(sumSessionMinutes(session)).toBe(10);
  });

  it('returns 0 for an empty list and for a missing one', () => {
    expect(sumSessionMinutes(makeSession())).toBe(0);
    expect(sumSessionMinutes(withoutTasks)).toBe(0);
  });

  it('does not clamp: negative minutes subtract from the total', () => {
    const session = makeSession({
      sessionTasks: [
        makeSessionTask({ taskId: 'a', durationMinutes: 30 }),
        makeSessionTask({ taskId: 'b', durationMinutes: -10 }),
      ],
    });

    expect(sumSessionMinutes(session)).toBe(20);
  });
});

describe('formatMinutes', () => {
  it.each([
    [0, '0 min'],
    [1, '1 min'],
    [59, '59 min'],
    [60, '1h'],
    [61, '1h 1m'],
    [90, '1h 30m'],
    [120, '2h'],
    [125, '2h 5m'],
  ])('renders %i as %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it('drops the minute part only on a whole hour', () => {
    expect(formatMinutes(180)).toBe('3h');
    expect(formatMinutes(181)).toBe('3h 1m');
  });

  // The three below record what the function does today, not what it should do. They are
  // here so a later guard is a deliberate, visible change rather than a silent one.
  it('passes negatives straight through, since they fail the `< 60` branch test', () => {
    expect(formatMinutes(-5)).toBe('-5 min');
  });

  it('does not round fractional minutes', () => {
    expect(formatMinutes(90.5)).toBe('1h 30.5m');
  });

  it('renders NaN as "NaNh NaNm" — unlike formatClock, it guards nothing', () => {
    // `NaN < 60` is false, so NaN takes the hours branch. Per-task minutes are optional
    // throughout the API, so this is reachable rather than theoretical.
    expect(formatMinutes(Number.NaN)).toBe('NaNh NaNm');
  });
});

describe('countCompletedTasks', () => {
  it('counts completed against total', () => {
    const session = makeSession({
      sessionTasks: [
        makeSessionTask({ taskId: 'a', completed: true }),
        makeSessionTask({ taskId: 'b', completed: false }),
        makeSessionTask({ taskId: 'c', completed: true }),
      ],
    });

    expect(countCompletedTasks(session)).toEqual({ completed: 2, total: 3 });
  });

  it('returns zeroes for an empty list and for a missing one', () => {
    expect(countCompletedTasks(makeSession())).toEqual({ completed: 0, total: 0 });
    expect(countCompletedTasks(withoutTasks)).toEqual({ completed: 0, total: 0 });
  });
});

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [59, '0:59'],
    [60, '1:00'],
    [61, '1:01'],
    [600, '10:00'],
  ])('renders %i seconds as %s', (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });

  it('floors fractional seconds, which the audio scrubber passes in', () => {
    expect(formatClock(61.9)).toBe('1:01');
    expect(formatClock(0.4)).toBe('0:00');
  });

  it.each([
    ['a negative', -3],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('falls back to 0:00 for %s', (_label, seconds) => {
    expect(formatClock(seconds)).toBe('0:00');
  });

  it('keeps counting minutes past an hour instead of rolling over', () => {
    // Deliberate for a practice stopwatch: 3600 is "60:00", not "1:00:00".
    expect(formatClock(3600)).toBe('60:00');
    expect(formatClock(7265)).toBe('121:05');
  });
});
