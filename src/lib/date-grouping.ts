import type { PracticeSession } from '@/types/session';

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay(); // 0 = Sunday
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * There is no analytics endpoint — "this week" is derived client-side by filtering
 * sessions to the current week (see plan/SETUP-PLAN.md "API constraints").
 */
export function filterThisWeek(sessions: PracticeSession[], now = new Date()) {
  const start = startOfWeek(now);
  return sessions.filter((session) => new Date(session.createdAt) >= start);
}

/**
 * `YYYY-MM-DD` for the calendar day a timestamp falls on in `timeZone`.
 *
 * Assembled from numeric parts rather than a formatted string: every locale-aware format is
 * the host's to choose, and a laptop and CI's ICU build do not choose the same one.
 *
 * A timestamp the platform cannot parse falls back to the leading date of the ISO string, so
 * an unexpected shape still groups together under a visible key instead of throwing.
 */
function localDateKey(createdAt: string, timeZone: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt.slice(0, 10);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Grouped on the viewer's calendar day, which is the same basis `filterThisWeek` uses and the
 * same day the session detail screen prints.
 *
 * It used to key on `createdAt.slice(0, 10)` — the UTC date in the string — so under a
 * negative UTC offset an evening session filed under tomorrow's heading while Home's weekly
 * total left it out, and History disagreed with the detail screen it linked to.
 *
 * `timeZone` is injectable only so a test can pin one: Jest fixes `TZ=UTC`, which would make a
 * host-zone assertion prove nothing.
 */
export function groupSessionsByDay(
  sessions: PracticeSession[],
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const groups = new Map<string, PracticeSession[]>();
  for (const session of sessions) {
    const key = localDateKey(session.createdAt, timeZone);
    const group = groups.get(key) ?? [];
    group.push(session);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, items]) => ({ date, sessions: items }));
}
