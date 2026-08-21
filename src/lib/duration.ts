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
