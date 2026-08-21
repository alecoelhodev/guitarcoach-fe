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

export function groupSessionsByDay(sessions: PracticeSession[]) {
  const groups = new Map<string, PracticeSession[]>();
  for (const session of sessions) {
    const key = session.createdAt.slice(0, 10); // YYYY-MM-DD
    const group = groups.get(key) ?? [];
    group.push(session);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, items]) => ({ date, sessions: items }));
}
