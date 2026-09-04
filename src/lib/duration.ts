import type { PracticeSession } from '@/types/session';

/** Every total in the app is a sum of per-task minutes — there is no total-elapsed field. */
export function sumSessionMinutes(session: Pick<PracticeSession, 'sessionTasks'>) {
  return (session.sessionTasks ?? []).reduce(
    (total, task) => total + (task.durationMinutes ?? 0),
    0,
  );
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** Canvas shows completion as "3 of 4 done" on session cards and on Home. */
export function countCompletedTasks(session: Pick<PracticeSession, 'sessionTasks'>) {
  const tasks = session.sessionTasks ?? [];
  return { completed: tasks.filter((task) => task.completed).length, total: tasks.length };
}

/** mm:ss, for the session stopwatch and the recording scrubber. */
export function formatClock(totalSeconds: number) {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}
