import { formatMinutes } from '@/lib/duration';
import type { Routine } from '@/types/routine';

/**
 * Canvas 02 / 2a label every routine card with "4 tasks · 45 min".
 *
 * Both figures come from the backend (`RoutineResponseDto`) rather than a query
 * per card — resolving them client-side would be one request per row.
 */
export function formatRoutineMeta({
  taskCount,
  totalTargetDurationMinutes,
}: Pick<Routine, 'taskCount' | 'totalTargetDurationMinutes'>) {
  const tasks = `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;

  // Target durations are optional per routine task, so a fully-populated routine
  // can still total zero — "4 tasks · 0 min" would read as a bug rather than a gap.
  return totalTargetDurationMinutes > 0
    ? `${tasks} · ${formatMinutes(totalTargetDurationMinutes)}`
    : tasks;
}
