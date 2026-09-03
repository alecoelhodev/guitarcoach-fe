/**
 * Every key carries a kind segment (`list` / `detail` / `summary`) after its root. Without
 * one, a `useQuery` and a `useInfiniteQuery` over the same filters produce the identical
 * key and TanStack throws on the mismatched query type — which `sessions` and
 * `sessionsSummary` were one `limit` argument away from doing.
 *
 * Roots stay the first segment so `invalidateQueries({ queryKey: tasksRoot })` still
 * matches every list and detail beneath it.
 */
export const queryKeys = {
  authSession: ['auth', 'session'] as const,
  me: ['auth', 'me'] as const,

  tasksRoot: ['tasks'] as const,
  tasks: (query?: Record<string, unknown>) => ['tasks', 'list', query] as const,
  task: (id: string) => ['tasks', 'detail', id] as const,

  routinesRoot: ['routines'] as const,
  routines: (query?: Record<string, unknown>) => ['routines', 'list', query] as const,
  routine: (id: string) => ['routines', 'detail', id] as const,
  routineTasks: (routineId: string) => ['routines', 'detail', routineId, 'tasks'] as const,

  sessionsRoot: ['sessions'] as const,
  sessions: (query?: Record<string, unknown>) => ['sessions', 'list', query] as const,
  sessionsSummary: (limit: number) => ['sessions', 'summary', limit] as const,
  session: (id: string) => ['sessions', 'detail', id] as const,

  recordings: (sessionId: string) => ['sessions', 'detail', sessionId, 'recordings'] as const,
};
