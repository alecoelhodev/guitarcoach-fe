import { useRoutine, useRoutines, useRoutineTasks } from '@/api/routines.queries';
import { useSessionsSummary } from '@/api/sessions.queries';

/**
 * Canvas 02's "Today's practice" card.
 *
 * The backend has no scheduled-routine concept, so the pick is derived: the
 * routine behind the most recent session, falling back to the newest active
 * routine for someone who has never practised.
 *
 * Both source queries are already mounted by Home ("This week" and the active-
 * routines strip), so the pick itself costs nothing; only the chosen routine's
 * task list is an extra request — one, not one per card.
 */
export function useTodaysPractice() {
  const sessions = useSessionsSummary();
  const routines = useRoutines({ status: 'active', limit: ACTIVE_ROUTINE_LIMIT });

  const lastPractisedId = sessions.data?.data.find((session) => session.routineId)?.routineId;
  const activeRoutines = routines.data?.pages.flatMap((page) => page.data) ?? [];
  const routineId = lastPractisedId ?? activeRoutines[0]?.id;

  // Both hooks no-op until an id exists, and key on it, so the routine detail
  // screen shares these cache entries rather than refetching them.
  const routine = useRoutine(routineId);
  const tasks = useRoutineTasks(routineId);

  return {
    routine: routineId ? routine.data : undefined,
    taskTitles: (tasks.data ?? []).map((routineTask) => routineTask.task.title),
    activeRoutines,
    // Only the two list queries gate the card: without a routineId there is
    // nothing to show, and waiting on a query that never runs would hang it.
    isPending: sessions.isPending || routines.isPending || (!!routineId && routine.isPending),
    hasLoaded: !sessions.isPending && !routines.isPending,
  };
}

/** Canvas 2a draws three routine cards; the mobile strip shows two and scrolls. */
export const ACTIVE_ROUTINE_LIMIT = 3;
