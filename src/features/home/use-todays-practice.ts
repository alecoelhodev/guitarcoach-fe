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

  // `routineId` is nullable on the session DTO; normalise so the `enabled` guards below see
  // a plain `string | undefined`.
  const lastPractisedId =
    sessions.data?.data.find((session) => session.routineId)?.routineId ?? undefined;
  const activeRoutines = routines.data?.pages.flatMap((page) => page.data) ?? [];

  // Canvas 839: archived routines are reviewable but never surfaced as today's
  // recommendation, and the most recent session may well point at one. The two
  // `useRoutine` calls share a cache key whenever the pick stands, so resolving
  // the status costs no extra request in the common case.
  const lastPractised = useRoutine(lastPractisedId);
  const routineId =
    lastPractisedId && lastPractised.data?.status === 'active'
      ? lastPractisedId
      : activeRoutines[0]?.id;

  // Both hooks no-op until an id exists, and key on it, so the routine detail
  // screen shares these cache entries rather than refetching them.
  const routine = useRoutine(routineId);
  const tasks = useRoutineTasks(routineId);

  return {
    routine: routineId ? routine.data : undefined,
    /** The card joins these with " · "; `routineTasks` is what starting the session needs. */
    taskTitles: (tasks.data ?? []).map((routineTask) => routineTask.task.title),
    routineTasks: tasks.data,
    activeRoutines,
    // A failed list query leaves both arrays empty, which is indistinguishable from a
    // genuinely new account — Home has to know the difference before it renders 02c.
    isError: sessions.isError || routines.isError,
    /** Passed to `describeError` so Home says "No connection" rather than a generic panel. */
    error: sessions.error ?? routines.error,
    retry: () => {
      if (sessions.isError) sessions.refetch();
      if (routines.isError) routines.refetch();
    },
    // Only the list queries gate the card: without a routineId there is nothing to show,
    // and waiting on a query that never runs would hang it. The archived check is part of
    // the gate, or the card paints the archived routine before swapping it out.
    hasLoaded:
      !sessions.isPending && !routines.isPending && !(lastPractisedId && lastPractised.isPending),
  };
}

/** Canvas 2a draws three routine cards; the mobile strip shows two and scrolls. */
export const ACTIVE_ROUTINE_LIMIT = 3;
