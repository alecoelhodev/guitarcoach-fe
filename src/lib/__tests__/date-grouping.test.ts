import { filterThisWeek, groupSessionsByDay } from '@/lib/date-grouping';
import { makeSession } from '@/test/fixtures';

/**
 * `jest.config.js` pins `process.env.TZ = 'UTC'`. Both functions here are timezone-
 * dependent — `filterThisWeek` compares local `Date`s and `groupSessionsByDay` slices the
 * raw ISO string — so without that pin these assertions would differ between a dev machine
 * and CI's UTC runner. Do not assert on the host zone.
 */

/** 2026-09-06 is a Sunday, and `startOfWeek` anchors to Sunday. */
const WEDNESDAY = new Date('2026-09-09T12:00:00.000Z');
const SUNDAY_START = '2026-09-06T00:00:00.000Z';

const at = (createdAt: string) => makeSession({ id: createdAt, createdAt });

describe('filterThisWeek', () => {
  it('keeps sessions from the current Sunday-anchored week', () => {
    const sessions = [at('2026-09-07T09:00:00.000Z'), at('2026-09-09T09:00:00.000Z')];

    expect(filterThisWeek(sessions, WEDNESDAY)).toHaveLength(2);
  });

  it('drops the session just before the week started', () => {
    const sessions = [at('2026-09-05T23:59:59.000Z'), at('2026-09-07T09:00:00.000Z')];

    expect(filterThisWeek(sessions, WEDNESDAY).map((s) => s.id)).toEqual([
      '2026-09-07T09:00:00.000Z',
    ]);
  });

  it('includes a session landing exactly on the week boundary', () => {
    expect(filterThisWeek([at(SUNDAY_START)], WEDNESDAY)).toHaveLength(1);
  });

  it('counts a Sunday `now` as the first day of its own week, not the last of the previous', () => {
    const sunday = new Date('2026-09-06T08:00:00.000Z');

    expect(filterThisWeek([at('2026-09-06T07:00:00.000Z')], sunday)).toHaveLength(1);
  });

  it('has no upper bound, so a future-dated session counts as this week', () => {
    // Not obviously desirable, but it is what Home's weekly total does today.
    expect(filterThisWeek([at('2027-01-01T00:00:00.000Z')], WEDNESDAY)).toHaveLength(1);
  });

  it('silently drops an unparseable createdAt rather than throwing', () => {
    // `new Date('nonsense') >= start` is false because every NaN comparison is.
    expect(filterThisWeek([at('nonsense')], WEDNESDAY)).toEqual([]);
  });

  it('returns an empty list unchanged', () => {
    expect(filterThisWeek([], WEDNESDAY)).toEqual([]);
  });
});

describe('groupSessionsByDay', () => {
  it('groups by calendar day, newest day first', () => {
    const groups = groupSessionsByDay([
      at('2026-09-01T10:00:00.000Z'),
      at('2026-09-03T10:00:00.000Z'),
      at('2026-09-02T10:00:00.000Z'),
    ]);

    expect(groups.map((group) => group.date)).toEqual(['2026-09-03', '2026-09-02', '2026-09-01']);
  });

  it('keeps every session for a day in one group, in the order the server sent them', () => {
    const groups = groupSessionsByDay([
      at('2026-09-03T08:00:00.000Z'),
      at('2026-09-03T20:00:00.000Z'),
      at('2026-09-03T14:00:00.000Z'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].sessions.map((s) => s.id)).toEqual([
      '2026-09-03T08:00:00.000Z',
      '2026-09-03T20:00:00.000Z',
      '2026-09-03T14:00:00.000Z',
    ]);
  });

  it('returns an empty list unchanged', () => {
    expect(groupSessionsByDay([])).toEqual([]);
  });

  it('falls back to the leading ISO date when a timestamp will not parse', () => {
    // Not a shape the API produces, but the grouping must not throw on it — an unparseable
    // value gets a visible key of its own rather than taking the screen down.
    expect(groupSessionsByDay([at('nonsense')])[0].date).toBe('nonsense');
  });

  /**
   * QA-07. Grouping keyed on `createdAt.slice(0, 10)` — the UTC date in the string — while
   * `filterThisWeek` compares local time, so an evening session in a negative-offset zone
   * filed under tomorrow's heading on History and was left out of Home's weekly total. Worse,
   * History disagreed with the session detail screen it linked to.
   *
   * The zone is passed explicitly because `jest.config.js` pins `TZ=UTC`, under which local
   * and UTC agree and an assertion on the host zone would prove nothing either way.
   */
  it('groups on the viewer calendar day, not the UTC date in the string', () => {
    // 2026-09-17, 20:22 in New York.
    const groups = groupSessionsByDay([at('2026-09-18T00:22:00.000Z')], 'America/New_York');

    expect(groups[0].date).toBe('2026-09-17');
  });

  it('keeps an evening and the following morning in different local groups', () => {
    const groups = groupSessionsByDay(
      [at('2026-09-18T00:22:00.000Z'), at('2026-09-18T13:00:00.000Z')],
      'America/New_York',
    );

    expect(groups.map((group) => group.date)).toEqual(['2026-09-18', '2026-09-17']);
  });

  it('groups on the UTC day when the viewer is in UTC', () => {
    const groups = groupSessionsByDay([at('2026-09-06T01:00:00.000Z')], 'UTC');

    expect(groups[0].date).toBe('2026-09-06');
  });
});
